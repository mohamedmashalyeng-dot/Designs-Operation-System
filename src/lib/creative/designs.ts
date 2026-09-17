import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImageEvalProvider, getImageProvider, getLLMProvider } from "@/lib/ai";
import {
  designEditSchema,
  imageReviewSchema,
  visualDirectionSchema,
  SCHEMA_NAMES,
  type ImageReview,
} from "@/lib/ai/schemas";
import {
  AI_EDITOR_INSTRUCTIONS,
  IMAGE_REVIEWER_INSTRUCTIONS,
  VISUAL_DIRECTOR_INSTRUCTIONS,
  buildEditPrompt,
  buildImageReviewPrompt,
  buildVisualDirectorPrompt,
} from "@/lib/ai/prompts";
import { extensionForMimeType, generatedImagePath } from "@/lib/storage/paths";
import { getSignedUrl } from "@/lib/storage/signed-url";
import { downloadAsBase64 } from "@/lib/storage/download";
import { getFormat, orientationForFormat } from "./formats";
import { getLayoutPreset, defaultLayoutForOrientation } from "./layouts";
import { getBrandContext } from "./brand-context";
import { briefRowToCreativeBrief, getLatestBrief } from "./briefs";
import { conceptRowToCreativeConcept } from "./concepts";

export interface DesignWithVersion {
  design: Tables<"designs">;
  version: Tables<"design_versions">;
  asset: Tables<"generated_assets">;
  aiReview: ImageReview | null;
}

async function getNextVersionNumber(supabase: SupabaseClient<Database>, designId: string): Promise<number> {
  const { data } = await supabase
    .from("design_versions")
    .select("version_number")
    .eq("design_id", designId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

interface GenerateVersionParams {
  designId: string;
  imagePrompt: string;
  headline: string;
  supportingCopy: string;
  cta: string;
  layoutPreset?: string;
  changeDescription: string;
  changedByAI: boolean;
  changedByUserId?: string;
  /** When set, edits this source image instead of generating from scratch. */
  editSource?: { base64: string; mimeType: string };
}

/**
 * The single entry point for turning a prompt into a new, reviewable
 * design version — used for the very first generation from a concept AND
 * for every later regenerate/AI-edit, per product spec §13: "AI changes
 * should produce a new version rather than destroying the previous one."
 *
 * Runs synchronously within the request (see README "Scaling notes" — a
 * queue is the natural next step once generation volume justifies one).
 */
export async function generateAndAttachVersion(
  supabase: SupabaseClient<Database>,
  params: GenerateVersionParams
): Promise<DesignWithVersion> {
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("*")
    .eq("id", params.designId)
    .single();
  if (designError || !design) throw new Error("Design not found");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", design.campaign_id)
    .single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const format = getFormat(design.format_id);
  let layoutPreset = params.layoutPreset;
  if (!layoutPreset && design.current_version_id) {
    const { data: currentVersion } = await supabase
      .from("design_versions")
      .select("layout_preset")
      .eq("id", design.current_version_id)
      .maybeSingle();
    layoutPreset = currentVersion?.layout_preset;
  }
  layoutPreset ??= defaultLayoutForOrientation(orientationForFormat(format));

  await supabase.from("designs").update({ status: "generating" }).eq("id", design.id);

  const imageProvider = getImageProvider();
  const { data: asset, error: assetError } = await supabase
    .from("generated_assets")
    .insert({
      organisation_id: campaign.organisation_id,
      campaign_id: campaign.id,
      concept_id: design.concept_id,
      provider: imageProvider.id,
      model: "pending",
      prompt: params.imagePrompt,
      width: format.width,
      height: format.height,
      status: "generating",
    })
    .select()
    .single();
  if (assetError || !asset) throw new Error(assetError?.message ?? "Failed to create asset record");

  try {
    const result = params.editSource
      ? await imageProvider.edit({
          prompt: params.imagePrompt,
          sourceImageBase64: params.editSource.base64,
          sourceMimeType: params.editSource.mimeType,
          width: format.width,
          height: format.height,
        })
      : await imageProvider.generate({ prompt: params.imagePrompt, width: format.width, height: format.height });

    const image = result.images[0];
    const ext = extensionForMimeType(image.mimeType);
    const path = generatedImagePath(campaign.organisation_id, campaign.id, asset.id, ext);

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("generated-images")
      .upload(path, Buffer.from(image.base64, "base64"), { contentType: image.mimeType, upsert: true });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: completedAsset, error: assetUpdateError } = await supabase
      .from("generated_assets")
      .update({ status: "completed", storage_path: path, mime_type: image.mimeType, model: result.model, provider: result.provider })
      .eq("id", asset.id)
      .select()
      .single();
    if (assetUpdateError || !completedAsset) throw new Error(assetUpdateError?.message ?? "Failed to finalise asset");

    const versionNumber = await getNextVersionNumber(supabase, design.id);
    const { data: version, error: versionError } = await supabase
      .from("design_versions")
      .insert({
        design_id: design.id,
        version_number: versionNumber,
        headline: params.headline,
        supporting_copy: params.supportingCopy,
        cta: params.cta,
        generated_asset_id: asset.id,
        layout_preset: layoutPreset,
        change_description: params.changeDescription,
        changed_by_user_id: params.changedByUserId ?? null,
        changed_by_ai: params.changedByAI,
        ai_prompt: params.imagePrompt,
      })
      .select()
      .single();
    if (versionError || !version) throw new Error(versionError?.message ?? "Failed to save design version");

    await supabase.from("generated_assets").update({ design_version_id: version.id }).eq("id", asset.id);

    const aiReview = await runAIReview(supabase, { campaign, design, version, storagePath: path });

    await supabase
      .from("designs")
      .update({ status: "human_review", current_version_id: version.id })
      .eq("id", design.id);

    const { data: updatedDesign } = await supabase.from("designs").select("*").eq("id", design.id).single();

    return { design: updatedDesign ?? design, version: { ...version, ai_review: aiReview }, asset: completedAsset, aiReview };
  } catch (error) {
    await supabase
      .from("generated_assets")
      .update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown error" })
      .eq("id", asset.id);
    await supabase.from("designs").update({ status: "draft" }).eq("id", design.id);
    throw error;
  }
}

/** Best-effort automated brand/quality gate. A failure here should never
 * take down a successful generation — it just means the version proceeds
 * straight to human review with no AI pre-check. */
async function runAIReview(
  supabase: SupabaseClient<Database>,
  ctx: { campaign: Tables<"campaigns">; design: Tables<"designs">; version: Tables<"design_versions">; storagePath: string }
): Promise<ImageReview | null> {
  try {
    const [brand, concept] = await Promise.all([
      getBrandContext(supabase, ctx.campaign.organisation_id),
      supabase.from("creative_concepts").select("creative_brief_id").eq("id", ctx.design.concept_id).single(),
    ]);

    let brief = null;
    if (concept.data?.creative_brief_id) {
      const { data } = await supabase
        .from("creative_briefs")
        .select("*")
        .eq("id", concept.data.creative_brief_id)
        .single();
      brief = data;
    }
    if (!brief) return null;

    const signedUrl = await getSignedUrl(supabase, "generated-images", ctx.storagePath, 600);
    const evalResult = await getImageEvalProvider().evaluate({
      schemaName: SCHEMA_NAMES.imageReview,
      schema: imageReviewSchema,
      instructions: IMAGE_REVIEWER_INSTRUCTIONS,
      prompt: buildImageReviewPrompt({ brief: briefRowToCreativeBrief(brief), brand }),
      imageUrl: signedUrl,
    });

    await supabase.from("design_versions").update({ ai_review: evalResult.data }).eq("id", ctx.version.id);
    return evalResult.data;
  } catch (error) {
    console.error("AI review step failed (non-fatal):", error);
    return null;
  }
}

export interface DesignVariation {
  assetId: string;
  storagePath: string;
  label: string;
  imagePrompt: string;
}

export interface VariationsBatch {
  design: Tables<"designs">;
  batchId: string;
  variations: DesignVariation[];
  headline: string;
  supportingCopy: string;
  cta: string;
  layoutPreset: string;
  failedCount: number;
}

/**
 * AI Visual Director + batch generation (product spec §3/§9): produces a
 * shared production brief and 4 concrete, meaningfully-different visual
 * variations for a design's target format, uploads each, and leaves them
 * unattached to any version — `chooseVariation` is what turns a pick into
 * design_version 1 (or a later version, for "Regenerate Creative"). Partial
 * failure is tolerated: whatever variations succeed are returned, failed
 * ones are recorded on their own asset row rather than failing the batch.
 */
export async function generateVariations(
  supabase: SupabaseClient<Database>,
  params: { designId: string; layoutPreset?: string; headline?: string; supportingCopy?: string; cta?: string }
): Promise<VariationsBatch> {
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("*")
    .eq("id", params.designId)
    .single();
  if (designError || !design) throw new Error("Design not found");

  const { data: concept, error: conceptError } = await supabase
    .from("creative_concepts")
    .select("*")
    .eq("id", design.concept_id)
    .single();
  if (conceptError || !concept) throw new Error("Concept not found");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", design.campaign_id)
    .single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const briefRow = await getLatestBrief(supabase, campaign.id);
  if (!briefRow) throw new Error("Generate a creative brief before generating visuals");

  let currentVersion: Tables<"design_versions"> | null = null;
  if (design.current_version_id) {
    const { data } = await supabase.from("design_versions").select("*").eq("id", design.current_version_id).maybeSingle();
    currentVersion = data ?? null;
  }

  const format = getFormat(design.format_id);
  const orientation = orientationForFormat(format);
  const layoutPreset = params.layoutPreset ?? currentVersion?.layout_preset ?? defaultLayoutForOrientation(orientation);
  const layout = getLayoutPreset(layoutPreset);
  const headline = params.headline ?? currentVersion?.headline ?? concept.headline;
  const supportingCopy = params.supportingCopy ?? currentVersion?.supporting_copy ?? concept.supporting_copy;
  const cta = params.cta ?? currentVersion?.cta ?? concept.cta;

  const previousStatus = design.status;
  await supabase.from("designs").update({ status: "generating" }).eq("id", design.id);

  try {
    const brand = await getBrandContext(supabase, campaign.organisation_id);

    const direction = await getLLMProvider().generateStructured({
      schemaName: SCHEMA_NAMES.visualDirection,
      schema: visualDirectionSchema,
      instructions: VISUAL_DIRECTOR_INSTRUCTIONS,
      prompt: buildVisualDirectorPrompt({
        brief: briefRowToCreativeBrief(briefRow),
        concept: conceptRowToCreativeConcept(concept),
        audienceType: campaign.audience_type,
        objective: campaign.objective,
        channels: campaign.channels,
        formatLabel: `${format.platform} ${format.label}`,
        aspectRatio: format.aspectRatio,
        layoutCompositionNote: layout.compositionNote,
        brand,
      }),
    });

    const batchId = randomUUID();
    const imageProvider = getImageProvider();
    const variations: DesignVariation[] = [];
    let failedCount = 0;

    for (const variation of direction.data.variations) {
      const { data: asset } = await supabase
        .from("generated_assets")
        .insert({
          organisation_id: campaign.organisation_id,
          campaign_id: campaign.id,
          concept_id: design.concept_id,
          provider: imageProvider.id,
          model: "pending",
          prompt: variation.imagePrompt,
          width: format.width,
          height: format.height,
          status: "generating",
          generation_batch_id: batchId,
        })
        .select()
        .single();
      if (!asset) {
        failedCount += 1;
        continue;
      }

      try {
        const result = await imageProvider.generate({ prompt: variation.imagePrompt, width: format.width, height: format.height });
        const image = result.images[0];
        const ext = extensionForMimeType(image.mimeType);
        const path = generatedImagePath(campaign.organisation_id, campaign.id, asset.id, ext);

        const admin = createAdminClient();
        const { error: uploadError } = await admin.storage
          .from("generated-images")
          .upload(path, Buffer.from(image.base64, "base64"), { contentType: image.mimeType, upsert: true });
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        await supabase
          .from("generated_assets")
          .update({ status: "completed", storage_path: path, mime_type: image.mimeType, model: result.model, provider: result.provider })
          .eq("id", asset.id);

        variations.push({ assetId: asset.id, storagePath: path, label: variation.label, imagePrompt: variation.imagePrompt });
      } catch (err) {
        failedCount += 1;
        await supabase
          .from("generated_assets")
          .update({ status: "failed", error_message: err instanceof Error ? err.message : "Generation failed" })
          .eq("id", asset.id);
      }
    }

    if (variations.length === 0) {
      throw new Error("All visual variations failed to generate — try again.");
    }

    const { data: updatedDesign, error: updateError } = await supabase
      .from("designs")
      .update({ status: "variations_ready", latest_batch_id: batchId })
      .eq("id", design.id)
      .select()
      .single();
    if (updateError || !updatedDesign) throw new Error(updateError?.message ?? "Failed to save design");

    return { design: updatedDesign, batchId, variations, headline, supportingCopy, cta, layoutPreset, failedCount };
  } catch (error) {
    await supabase.from("designs").update({ status: previousStatus === "generating" ? "draft" : previousStatus }).eq("id", design.id);
    throw error;
  }
}

/** Turns a chosen candidate from `generateVariations` into a real design
 * version — no new image generation, just attaches the already-uploaded
 * asset (product spec §9 "select one"). Runs the same AI review as any
 * other version. */
export async function chooseVariation(
  supabase: SupabaseClient<Database>,
  params: {
    designId: string;
    assetId: string;
    headline: string;
    supportingCopy: string;
    cta: string;
    layoutPreset: string;
    changeDescription: string;
    changedByUserId: string;
  }
): Promise<DesignWithVersion> {
  const { data: design, error: designError } = await supabase.from("designs").select("*").eq("id", params.designId).single();
  if (designError || !design) throw new Error("Design not found");

  const { data: asset, error: assetError } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("id", params.assetId)
    .eq("status", "completed")
    .single();
  if (assetError || !asset || !asset.storage_path) throw new Error("Chosen visual not found");

  const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("*").eq("id", design.campaign_id).single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const versionNumber = await getNextVersionNumber(supabase, design.id);
  const { data: version, error: versionError } = await supabase
    .from("design_versions")
    .insert({
      design_id: design.id,
      version_number: versionNumber,
      headline: params.headline,
      supporting_copy: params.supportingCopy,
      cta: params.cta,
      generated_asset_id: asset.id,
      layout_preset: params.layoutPreset,
      change_description: params.changeDescription,
      changed_by_user_id: params.changedByUserId,
      changed_by_ai: false,
      ai_prompt: asset.prompt,
    })
    .select()
    .single();
  if (versionError || !version) throw new Error(versionError?.message ?? "Failed to save design version");

  await supabase.from("generated_assets").update({ design_version_id: version.id }).eq("id", asset.id);

  const aiReview = await runAIReview(supabase, { campaign, design, version, storagePath: asset.storage_path });

  await supabase.from("designs").update({ status: "human_review", current_version_id: version.id }).eq("id", design.id);
  const { data: updatedDesign } = await supabase.from("designs").select("*").eq("id", design.id).single();

  return { design: updatedDesign ?? design, version: { ...version, ai_review: aiReview }, asset, aiReview };
}

/** Creates the reviewable Design for a chosen concept in a chosen format
 * and kicks off its first variation batch. Marks the concept `selected` so
 * the UI can show which of the ~4 proposed concepts the campaign actually
 * continued with. */
export async function createDesignFromConcept(
  supabase: SupabaseClient<Database>,
  params: { conceptId: string; formatId: string }
): Promise<VariationsBatch> {
  const { data: concept, error: conceptError } = await supabase
    .from("creative_concepts")
    .select("*")
    .eq("id", params.conceptId)
    .single();
  if (conceptError || !concept) throw new Error("Concept not found");

  const { data: design, error: designError } = await supabase
    .from("designs")
    .insert({
      campaign_id: concept.campaign_id,
      concept_id: concept.id,
      title: concept.name,
      status: "draft",
      format_id: params.formatId,
    })
    .select()
    .single();
  if (designError || !design) throw new Error(designError?.message ?? "Failed to create design");

  await supabase.from("creative_concepts").update({ status: "selected" }).eq("id", params.conceptId);
  await supabase.from("campaigns").update({ status: "in_review" }).eq("id", concept.campaign_id);

  return generateVariations(supabase, { designId: design.id });
}

/** "Create another format" (product spec §26): a new Design targeting a
 * different platform size, faithful to the same concept and carrying over
 * the source's current copy — generated fresh through the same Visual
 * Director + variation-picker flow rather than stretching the existing
 * image, since a good crop for one aspect ratio is rarely a good crop for
 * a very different one. */
export async function adaptDesignFormat(
  supabase: SupabaseClient<Database>,
  params: { sourceDesignId: string; formatId: string }
): Promise<VariationsBatch> {
  const { data: source, error: sourceError } = await supabase.from("designs").select("*").eq("id", params.sourceDesignId).single();
  if (sourceError || !source) throw new Error("Design not found");
  if (!source.current_version_id) throw new Error("Approve a version before adapting it to another format");

  const { data: sourceVersion } = await supabase
    .from("design_versions")
    .select("headline, supporting_copy, cta")
    .eq("id", source.current_version_id)
    .single();

  const { data: design, error: designError } = await supabase
    .from("designs")
    .insert({
      campaign_id: source.campaign_id,
      concept_id: source.concept_id,
      title: source.title,
      status: "draft",
      format_id: params.formatId,
    })
    .select()
    .single();
  if (designError || !design) throw new Error(designError?.message ?? "Failed to create adapted design");

  return generateVariations(supabase, {
    designId: design.id,
    headline: sourceVersion?.headline,
    supportingCopy: sourceVersion?.supporting_copy,
    cta: sourceVersion?.cta,
  });
}

/** Manual headline/copy/CTA/layout edit (product spec §19) — never calls
 * the AI, just reuses the current image and creates a new version. Any
 * edit re-enters human review, same as an AI edit would, so an approved
 * design never silently drifts from what was actually approved. */
export async function editDesignCopy(
  supabase: SupabaseClient<Database>,
  params: { designId: string; headline: string; supportingCopy: string; cta: string; layoutPreset: string; userId: string }
): Promise<DesignWithVersion> {
  const { data: design, error: designError } = await supabase.from("designs").select("*").eq("id", params.designId).single();
  if (designError || !design) throw new Error("Design not found");
  if (!design.current_version_id) throw new Error("No version to edit yet");

  const { data: currentVersion, error: versionError } = await supabase
    .from("design_versions")
    .select("*")
    .eq("id", design.current_version_id)
    .single();
  if (versionError || !currentVersion) throw new Error("Current version not found");

  const versionNumber = await getNextVersionNumber(supabase, design.id);
  const { data: newVersion, error: insertError } = await supabase
    .from("design_versions")
    .insert({
      design_id: design.id,
      version_number: versionNumber,
      headline: params.headline,
      supporting_copy: params.supportingCopy,
      cta: params.cta,
      generated_asset_id: currentVersion.generated_asset_id,
      layout_preset: params.layoutPreset,
      change_description: "Copy edited manually",
      changed_by_user_id: params.userId,
      changed_by_ai: false,
      ai_prompt: currentVersion.ai_prompt,
      ai_review: currentVersion.ai_review,
    })
    .select()
    .single();
  if (insertError || !newVersion) throw new Error(insertError?.message ?? "Failed to save changes");

  await supabase.from("designs").update({ status: "human_review", current_version_id: newVersion.id }).eq("id", design.id);

  const asset = currentVersion.generated_asset_id
    ? (await supabase.from("generated_assets").select("*").eq("id", currentVersion.generated_asset_id).single()).data
    : null;
  if (!asset) throw new Error("Original asset missing");

  return {
    design: { ...design, status: "human_review", current_version_id: newVersion.id },
    version: newVersion,
    asset,
    aiReview: (newVersion.ai_review as ImageReview | null) ?? null,
  };
}

/** Points a design back at an earlier version (product spec §14 "restore
 * previous versions"). Never deletes anything — restoring just moves
 * `current_version_id`, so every version stays in history either way. */
export async function restoreVersion(
  supabase: SupabaseClient<Database>,
  params: { designId: string; versionId: string }
): Promise<Tables<"designs">> {
  const { data: version } = await supabase
    .from("design_versions")
    .select("id")
    .eq("id", params.versionId)
    .eq("design_id", params.designId)
    .single();
  if (!version) throw new Error("Version not found on this design");

  const { data: updated, error } = await supabase
    .from("designs")
    .update({ current_version_id: params.versionId, status: "human_review" })
    .eq("id", params.designId)
    .select()
    .single();
  if (error || !updated) throw new Error(error?.message ?? "Failed to restore version");
  return updated;
}

/**
 * Natural-language "Edit with AI" (product spec §13). Interprets free-text
 * feedback ("make this less corporate", "give me a stronger headline")
 * and applies the minimum necessary change: a copy-only edit reuses the
 * existing image and never calls the image provider at all; a visual
 * change re-generates through `generateAndAttachVersion`. Either way the
 * result is a new version — the prior one is never overwritten.
 */
export async function requestAIEdit(
  supabase: SupabaseClient<Database>,
  params: { designId: string; feedback: string; userId: string }
): Promise<DesignWithVersion> {
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("*")
    .eq("id", params.designId)
    .single();
  if (designError || !design) throw new Error("Design not found");
  if (!design.current_version_id) throw new Error("Design has no version yet to edit");

  const { data: currentVersion, error: versionError } = await supabase
    .from("design_versions")
    .select("*")
    .eq("id", design.current_version_id)
    .single();
  if (versionError || !currentVersion) throw new Error("Current version not found");

  const { data: concept, error: conceptError } = await supabase
    .from("creative_concepts")
    .select("creative_brief_id")
    .eq("id", design.concept_id)
    .single();
  if (conceptError || !concept) throw new Error("Concept not found");

  const { data: briefRow, error: briefError } = await supabase
    .from("creative_briefs")
    .select("*")
    .eq("id", concept.creative_brief_id)
    .single();
  if (briefError || !briefRow) throw new Error("Creative brief not found");

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", design.campaign_id).single();
  if (!campaign) throw new Error("Campaign not found");

  const brand = await getBrandContext(supabase, campaign.organisation_id);

  const editResult = await getLLMProvider().generateStructured({
    schemaName: SCHEMA_NAMES.designEdit,
    schema: designEditSchema,
    instructions: AI_EDITOR_INSTRUCTIONS,
    prompt: buildEditPrompt({
      currentHeadline: currentVersion.headline,
      currentSupportingCopy: currentVersion.supporting_copy,
      currentCta: currentVersion.cta,
      currentImagePrompt: currentVersion.ai_prompt ?? design.title,
      feedback: params.feedback,
      brief: briefRowToCreativeBrief(briefRow),
      brand,
    }),
  });

  if (editResult.data.changeType === "text_only") {
    const versionNumber = await getNextVersionNumber(supabase, design.id);
    const { data: newVersion, error: insertError } = await supabase
      .from("design_versions")
      .insert({
        design_id: design.id,
        version_number: versionNumber,
        headline: editResult.data.headline,
        supporting_copy: editResult.data.supportingCopy,
        cta: editResult.data.cta,
        generated_asset_id: currentVersion.generated_asset_id,
        layout_preset: currentVersion.layout_preset,
        change_description: editResult.data.editSummary,
        changed_by_user_id: params.userId,
        changed_by_ai: true,
        ai_prompt: currentVersion.ai_prompt,
        ai_review: currentVersion.ai_review,
      })
      .select()
      .single();
    if (insertError || !newVersion) throw new Error(insertError?.message ?? "Failed to save design version");

    await supabase.from("designs").update({ status: "human_review", current_version_id: newVersion.id }).eq("id", design.id);

    const asset = currentVersion.generated_asset_id
      ? (await supabase.from("generated_assets").select("*").eq("id", currentVersion.generated_asset_id).single()).data
      : null;
    if (!asset) throw new Error("Original asset missing for text-only edit");

    return {
      design: { ...design, status: "human_review", current_version_id: newVersion.id },
      version: newVersion,
      asset,
      aiReview: (newVersion.ai_review as ImageReview | null) ?? null,
    };
  }

  let editSource: { base64: string; mimeType: string } | undefined;
  if (currentVersion.generated_asset_id) {
    const { data: currentAsset } = await supabase
      .from("generated_assets")
      .select("storage_path")
      .eq("id", currentVersion.generated_asset_id)
      .single();
    if (currentAsset?.storage_path) {
      editSource = await downloadAsBase64(createAdminClient(), "generated-images", currentAsset.storage_path);
    }
  }

  return generateAndAttachVersion(supabase, {
    designId: design.id,
    imagePrompt: editResult.data.imagePrompt,
    headline: editResult.data.headline,
    supportingCopy: editResult.data.supportingCopy,
    cta: editResult.data.cta,
    layoutPreset: currentVersion.layout_preset,
    changeDescription: editResult.data.editSummary,
    changedByAI: true,
    changedByUserId: params.userId,
    editSource,
  });
}
