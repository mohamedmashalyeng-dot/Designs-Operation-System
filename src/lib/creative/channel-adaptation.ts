import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, Database, Tables } from "@/types/database";
import { getLLMProvider } from "@/lib/ai";
import { platformCopySchema, SCHEMA_NAMES } from "@/lib/ai/schemas";
import { PLATFORM_COPYWRITER_INSTRUCTIONS, buildPlatformCopyPrompt } from "@/lib/ai/prompts";
import { defaultFormatForChannel, getFormat, orientationForFormat } from "./formats";
import { defaultLayoutForOrientation } from "./layouts";
import { getBrandContext } from "./brand-context";
import { briefRowToCreativeBrief, getLatestBrief } from "./briefs";
import { conceptRowToCreativeConcept } from "./concepts";
import { generateAndAttachVersion, type DesignWithVersion } from "./designs";

/** Generates channel-specific copy via the Platform Copywriter (product
 * spec §7-11) — a distinct call per channel, never the same caption reused. */
async function generatePlatformCopy(
  supabase: SupabaseClient<Database>,
  params: { channel: Channel; campaignId: string; conceptId: string }
): Promise<{ headline: string; supportingCopy: string; cta: string }> {
  const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("*").eq("id", params.campaignId).single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const { data: concept, error: conceptError } = await supabase.from("creative_concepts").select("*").eq("id", params.conceptId).single();
  if (conceptError || !concept) throw new Error("Concept not found");

  const briefRow = await getLatestBrief(supabase, params.campaignId);
  if (!briefRow) throw new Error("Generate a creative brief before preparing channel copy");

  const brand = await getBrandContext(supabase, campaign.organisation_id);

  const result = await getLLMProvider().generateStructured({
    schemaName: SCHEMA_NAMES.platformCopy,
    schema: platformCopySchema,
    instructions: PLATFORM_COPYWRITER_INSTRUCTIONS,
    prompt: buildPlatformCopyPrompt({
      channel: params.channel,
      brief: briefRowToCreativeBrief(briefRow),
      concept: conceptRowToCreativeConcept(concept),
      objective: campaign.objective,
      audienceType: campaign.audience_type,
      brand,
    }),
  });

  const hashtagLine = result.data.hashtags.length ? `\n\n${result.data.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}` : "";
  return {
    headline: result.data.headline || concept.headline,
    supportingCopy: `${result.data.body}${hashtagLine}`,
    cta: result.data.cta,
  };
}

/** Same orientation category (landscape/portrait/square) = the approved
 * image can be recropped to fit; a genuine orientation change (e.g. a
 * landscape master adapted to a Story) can't be cropped into without
 * either losing the subject or leaving huge dead space, so that case
 * generates a fresh visual at the right orientation instead. */
function canReuseImage(sourceFormatId: string, targetFormatId: string): boolean {
  return orientationForFormat(getFormat(sourceFormatId)) === orientationForFormat(getFormat(targetFormatId));
}

export interface ChannelVersionResult extends DesignWithVersion {
  reusedImage: boolean;
}

/**
 * Prepares one channel's version of an approved master design (product
 * spec §5/§6/§48): platform-specific copy always regenerated; the visual
 * is recropped from the approved image when the orientation allows it,
 * otherwise regenerated fresh at the new format — never stretched.
 */
export async function prepareChannelVersion(
  supabase: SupabaseClient<Database>,
  params: { masterDesignId: string; channel: Channel; formatId?: string }
): Promise<ChannelVersionResult> {
  const { data: master, error: masterError } = await supabase.from("designs").select("*").eq("id", params.masterDesignId).single();
  if (masterError || !master) throw new Error("Master design not found");
  if (master.status !== "approved") throw new Error("Only an approved design can be adapted to other channels.");
  if (!master.current_version_id) throw new Error("Approved design has no version.");

  const { data: masterVersion, error: versionError } = await supabase
    .from("design_versions")
    .select("*")
    .eq("id", master.current_version_id)
    .single();
  if (versionError || !masterVersion?.generated_asset_id) throw new Error("Approved version has no image.");

  const { data: masterAsset } = await supabase.from("generated_assets").select("*").eq("id", masterVersion.generated_asset_id).single();
  if (!masterAsset?.storage_path) throw new Error("Approved image not found in storage.");

  const targetFormat = params.formatId ? getFormat(params.formatId) : defaultFormatForChannel(params.channel);
  const layoutPreset = defaultLayoutForOrientation(orientationForFormat(targetFormat));

  const copy = await generatePlatformCopy(supabase, { channel: params.channel, campaignId: master.campaign_id, conceptId: master.concept_id });

  const { data: channelDesign, error: designError } = await supabase
    .from("designs")
    .insert({
      campaign_id: master.campaign_id,
      concept_id: master.concept_id,
      title: `${master.title} — ${targetFormat.platform}`,
      status: "draft",
      format_id: targetFormat.id,
      master_design_id: master.id,
    })
    .select()
    .single();
  if (designError || !channelDesign) throw new Error(designError?.message ?? "Failed to create the channel version");

  const reusable = canReuseImage(master.format_id, targetFormat.id);

  if (reusable) {
    const { data: version, error: insertError } = await supabase
      .from("design_versions")
      .insert({
        design_id: channelDesign.id,
        version_number: 1,
        headline: copy.headline,
        supporting_copy: copy.supportingCopy,
        cta: copy.cta,
        generated_asset_id: masterAsset.id,
        layout_preset: layoutPreset,
        change_description: `Adapted from ${getFormat(master.format_id).label} with platform copy for ${targetFormat.platform}`,
        changed_by_ai: true,
        ai_prompt: masterVersion.ai_prompt,
      })
      .select()
      .single();
    if (insertError || !version) throw new Error(insertError?.message ?? "Failed to save the channel version");

    const { data: updatedDesign, error: statusError } = await supabase
      .from("designs")
      .update({ status: "human_review", current_version_id: version.id })
      .eq("id", channelDesign.id)
      .select()
      .single();
    if (statusError || !updatedDesign) throw new Error(statusError?.message ?? "Failed to finalise the channel version");

    return { design: updatedDesign, version, asset: masterAsset, aiReview: null, reusedImage: true };
  }

  const result = await generateAndAttachVersion(supabase, {
    designId: channelDesign.id,
    imagePrompt: masterVersion.ai_prompt ?? channelDesign.title,
    headline: copy.headline,
    supportingCopy: copy.supportingCopy,
    cta: copy.cta,
    layoutPreset,
    changeDescription: `Generated fresh for ${targetFormat.platform} — the approved image's orientation doesn't crop well to this ratio`,
    changedByAI: true,
  });

  return { ...result, reusedImage: false };
}

/** Prepares every selected channel's version in one call, tolerating a
 * per-channel failure without losing the others — mirrors the
 * partial-failure handling already used for visual variations. */
export async function prepareCampaignChannels(
  supabase: SupabaseClient<Database>,
  params: { masterDesignId: string; channels: Channel[] }
): Promise<{ succeeded: Tables<"designs">[]; failed: { channel: Channel; error: string }[] }> {
  const succeeded: Tables<"designs">[] = [];
  const failed: { channel: Channel; error: string }[] = [];

  for (const channel of params.channels) {
    try {
      const result = await prepareChannelVersion(supabase, { masterDesignId: params.masterDesignId, channel });
      succeeded.push(result.design);
    } catch (error) {
      failed.push({ channel, error: error instanceof Error ? error.message : "Failed to prepare this channel" });
    }
  }

  return { succeeded, failed };
}
