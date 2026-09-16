import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImageEvalProvider, getImageProvider, getLLMProvider } from "@/lib/ai";
import { designEditSchema, imageReviewSchema, SCHEMA_NAMES, type ImageReview } from "@/lib/ai/schemas";
import { AI_EDITOR_INSTRUCTIONS, IMAGE_REVIEWER_INSTRUCTIONS, buildEditPrompt, buildImageReviewPrompt } from "@/lib/ai/prompts";
import { extensionForMimeType, generatedImagePath } from "@/lib/storage/paths";
import { getSignedUrl } from "@/lib/storage/signed-url";
import { downloadAsBase64 } from "@/lib/storage/download";
import { getBrandContext } from "./brand-context";
import { briefRowToCreativeBrief } from "./briefs";

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;

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
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
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
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        })
      : await imageProvider.generate({ prompt: params.imagePrompt, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

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

/** Creates the reviewable Design for a chosen concept and runs its first
 * generation. Marks the concept `selected` so the UI can show which of
 * the ~4 proposed concepts the campaign actually continued with. */
export async function createDesignFromConcept(
  supabase: SupabaseClient<Database>,
  conceptId: string
): Promise<DesignWithVersion> {
  const { data: concept, error: conceptError } = await supabase
    .from("creative_concepts")
    .select("*")
    .eq("id", conceptId)
    .single();
  if (conceptError || !concept) throw new Error("Concept not found");

  const { data: design, error: designError } = await supabase
    .from("designs")
    .insert({ campaign_id: concept.campaign_id, concept_id: concept.id, title: concept.name, status: "draft" })
    .select()
    .single();
  if (designError || !design) throw new Error(designError?.message ?? "Failed to create design");

  await supabase.from("creative_concepts").update({ status: "selected" }).eq("id", conceptId);
  await supabase.from("campaigns").update({ status: "in_review" }).eq("id", concept.campaign_id);

  return generateAndAttachVersion(supabase, {
    designId: design.id,
    imagePrompt: concept.image_prompt,
    headline: concept.headline,
    supportingCopy: concept.supporting_copy,
    cta: concept.cta,
    changeDescription: "Initial generation from selected concept",
    changedByAI: true,
  });
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
    changeDescription: editResult.data.editSummary,
    changedByAI: true,
    changedByUserId: params.userId,
    editSource,
  });
}
