import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { getLLMProvider } from "@/lib/ai";
import { creativeBriefSchema, SCHEMA_NAMES, type CreativeBrief } from "@/lib/ai/schemas";
import { CREATIVE_DIRECTOR_INSTRUCTIONS, buildBriefPrompt } from "@/lib/ai/prompts";
import { getBrandContext } from "./brand-context";

/** Maps a `creative_briefs` row back to the camelCase shape the AI layer's
 * prompts and schema expect, so callers never hand-roll this mapping. */
export function briefRowToCreativeBrief(row: Tables<"creative_briefs">): CreativeBrief {
  return {
    campaignObjective: row.campaign_objective,
    targetAudience: row.target_audience,
    coreMessage: row.core_message,
    valueProposition: row.value_proposition,
    tone: row.tone,
    visualDirection: row.visual_direction,
    photographyDirection: row.photography_direction,
    emotionalDirection: row.emotional_direction,
    cta: row.cta,
    platformConsiderations: row.platform_considerations,
    constraints: row.constraints,
  };
}

export async function getLatestBrief(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<Tables<"creative_briefs"> | null> {
  const { data } = await supabase
    .from("creative_briefs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Runs the AI Creative Director over a campaign's raw prompt and persists
 * the structured brief. Campaigns can be re-briefed (each call inserts a
 * new row) — the UI always works off `getLatestBrief`.
 */
export async function generateCreativeBrief(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<Tables<"creative_briefs">> {
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  await supabase.from("campaigns").update({ status: "brief_generating" }).eq("id", campaignId);

  try {
    const brand = await getBrandContext(supabase, campaign.organisation_id);
    const llm = getLLMProvider();

    const result = await llm.generateStructured({
      schemaName: SCHEMA_NAMES.creativeBrief,
      schema: creativeBriefSchema,
      instructions: CREATIVE_DIRECTOR_INSTRUCTIONS,
      prompt: buildBriefPrompt({
        rawPrompt: campaign.raw_prompt,
        objective: campaign.objective,
        audienceType: campaign.audience_type,
        channels: campaign.channels,
        brand,
      }),
    });

    const { data: brief, error: insertError } = await supabase
      .from("creative_briefs")
      .insert({
        campaign_id: campaignId,
        campaign_objective: result.data.campaignObjective,
        target_audience: result.data.targetAudience,
        core_message: result.data.coreMessage,
        value_proposition: result.data.valueProposition,
        tone: result.data.tone,
        visual_direction: result.data.visualDirection,
        photography_direction: result.data.photographyDirection,
        emotional_direction: result.data.emotionalDirection,
        cta: result.data.cta,
        platform_considerations: result.data.platformConsiderations,
        constraints: result.data.constraints,
        model_used: result.model,
        raw_ai_response: result.data,
      })
      .select()
      .single();
    if (insertError || !brief) throw new Error(insertError?.message ?? "Failed to save creative brief");

    await supabase.from("campaigns").update({ status: "brief_ready" }).eq("id", campaignId);
    return brief;
  } catch (error) {
    await supabase.from("campaigns").update({ status: "draft" }).eq("id", campaignId);
    throw error;
  }
}
