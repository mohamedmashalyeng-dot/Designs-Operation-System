import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { getLLMProvider } from "@/lib/ai";
import { creativeConceptsSchema, SCHEMA_NAMES } from "@/lib/ai/schemas";
import { CONCEPT_GENERATOR_INSTRUCTIONS, buildConceptsPrompt } from "@/lib/ai/prompts";
import { getBrandContext } from "./brand-context";
import { briefRowToCreativeBrief, getLatestBrief } from "./briefs";

/**
 * Generates a fresh batch of creative concepts from a campaign's latest
 * brief. Clears out any still-`proposed` concepts from a prior batch first
 * — regenerating replaces an undecided set rather than piling on top of
 * it — but concepts already `selected` or `rejected` are left alone, since
 * a selected one has a design generated from it that must not be orphaned.
 */
export async function generateCreativeConcepts(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<Tables<"creative_concepts">[]> {
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const brief = await getLatestBrief(supabase, campaignId);
  if (!brief) throw new Error("Generate a creative brief before generating concepts");

  await supabase.from("campaigns").update({ status: "concepts_generating" }).eq("id", campaignId);

  try {
    const brand = await getBrandContext(supabase, campaign.organisation_id);
    const llm = getLLMProvider();

    const result = await llm.generateStructured({
      schemaName: SCHEMA_NAMES.creativeConcepts,
      schema: creativeConceptsSchema,
      instructions: CONCEPT_GENERATOR_INSTRUCTIONS,
      prompt: buildConceptsPrompt({
        brief: briefRowToCreativeBrief(brief),
        channels: campaign.channels,
        brand,
      }),
    });

    await supabase.from("creative_concepts").delete().eq("campaign_id", campaignId).eq("status", "proposed");

    const rows = result.data.concepts.map((concept, index) => ({
      campaign_id: campaignId,
      creative_brief_id: brief.id,
      name: concept.name,
      strategic_idea: concept.strategicIdea,
      visual_description: concept.visualDescription,
      headline: concept.headline,
      supporting_copy: concept.supportingCopy,
      cta: concept.cta,
      image_prompt: concept.imagePrompt,
      rationale: concept.rationale,
      display_order: index,
    }));

    const { data: concepts, error: insertError } = await supabase
      .from("creative_concepts")
      .insert(rows)
      .select();
    if (insertError || !concepts) throw new Error(insertError?.message ?? "Failed to save creative concepts");

    await supabase.from("campaigns").update({ status: "concepts_ready" }).eq("id", campaignId);
    return concepts;
  } catch (error) {
    await supabase.from("campaigns").update({ status: "brief_ready" }).eq("id", campaignId);
    throw error;
  }
}
