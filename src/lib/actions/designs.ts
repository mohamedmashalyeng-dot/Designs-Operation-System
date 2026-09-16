"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createDesignFromConcept, generateAndAttachVersion, requestAIEdit, restoreVersion } from "@/lib/creative/designs";
import { approveDesign, rejectDesign, addFeedbackComment } from "@/lib/creative/reviews";
import { aiEditSchema, feedbackCommentSchema, rejectDesignSchema } from "@/lib/validation/review";
import { updateConceptSchema } from "@/lib/validation/concept";
import type { ActionResult } from "./campaigns";

export async function selectConcept(campaignId: string, conceptId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  try {
    await createDesignFromConcept(supabase, conceptId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate design" };
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function rejectConcept(campaignId: string, conceptId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("creative_concepts").update({ status: "rejected" }).eq("id", conceptId);
  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function updateConceptAction(input: unknown): Promise<ActionResult> {
  const parsed = updateConceptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("creative_concepts")
    .update({
      name: parsed.data.name,
      headline: parsed.data.headline,
      supporting_copy: parsed.data.supportingCopy,
      cta: parsed.data.cta,
      image_prompt: parsed.data.imagePrompt,
    })
    .eq("id", parsed.data.conceptId);
  if (error) return { error: error.message };

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  return {};
}

export async function regenerateDesign(designId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: design, error } = await supabase.from("designs").select("*").eq("id", designId).single();
  if (error || !design) return { error: "Design not found" };

  // A design whose very first generation failed has no version yet to read
  // from — fall back to the concept it was created from, so "Regenerate"
  // still works as the retry path in that case (product spec §22).
  let source: { imagePrompt: string; headline: string; supportingCopy: string; cta: string };
  if (design.current_version_id) {
    const { data: version, error: versionError } = await supabase
      .from("design_versions")
      .select("*")
      .eq("id", design.current_version_id)
      .single();
    if (versionError || !version) return { error: "Version not found" };
    source = {
      imagePrompt: version.ai_prompt ?? version.headline,
      headline: version.headline,
      supportingCopy: version.supporting_copy,
      cta: version.cta,
    };
  } else {
    const { data: concept, error: conceptError } = await supabase
      .from("creative_concepts")
      .select("*")
      .eq("id", design.concept_id)
      .single();
    if (conceptError || !concept) return { error: "Concept not found" };
    source = {
      imagePrompt: concept.image_prompt,
      headline: concept.headline,
      supportingCopy: concept.supporting_copy,
      cta: concept.cta,
    };
  }

  try {
    await generateAndAttachVersion(supabase, {
      designId,
      imagePrompt: source.imagePrompt,
      headline: source.headline,
      supportingCopy: source.supportingCopy,
      cta: source.cta,
      changeDescription: design.current_version_id
        ? "Regenerated with the same brief (no changes requested)"
        : "Retried generation from the original concept",
      changedByAI: true,
      changedByUserId: user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Regeneration failed" };
  }

  revalidatePath(`/campaigns/${design.campaign_id}`);
  revalidatePath("/review");
  revalidatePath(`/review/${designId}`);
  return {};
}

export async function restoreVersionAction(designId: string, versionId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { data: design } = await supabase.from("designs").select("campaign_id").eq("id", designId).single();

  try {
    await restoreVersion(supabase, { designId, versionId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to restore version" };
  }

  if (design) revalidatePath(`/campaigns/${design.campaign_id}`);
  revalidatePath("/review");
  revalidatePath(`/review/${designId}`);
  return {};
}

export async function aiEditDesign(input: unknown): Promise<ActionResult> {
  const parsed = aiEditSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await requireUser();
  const supabase = await createClient();

  const { data: design } = await supabase.from("designs").select("campaign_id").eq("id", parsed.data.designId).single();

  try {
    await requestAIEdit(supabase, { designId: parsed.data.designId, feedback: parsed.data.feedback, userId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "AI edit failed" };
  }

  if (design) revalidatePath(`/campaigns/${design.campaign_id}`);
  revalidatePath("/review");
  revalidatePath(`/review/${parsed.data.designId}`);
  return {};
}

export async function approveDesignAction(designId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  try {
    await approveDesign(supabase, { designId, userId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to approve" };
  }
  revalidatePath("/review");
  revalidatePath("/review/approved");
  revalidatePath(`/review/${designId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function rejectDesignAction(input: unknown): Promise<ActionResult> {
  const parsed = rejectDesignSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await requireUser();
  const supabase = await createClient();
  try {
    await rejectDesign(supabase, { ...parsed.data, userId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reject" };
  }
  revalidatePath("/review");
  revalidatePath("/review/rejected");
  revalidatePath(`/review/${parsed.data.designId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function addFeedbackAction(input: unknown): Promise<ActionResult> {
  const parsed = feedbackCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await requireUser();
  const supabase = await createClient();
  try {
    await addFeedbackComment(supabase, { ...parsed.data, userId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save feedback" };
  }
  revalidatePath("/review");
  revalidatePath(`/review/${parsed.data.designId}`);
  return {};
}
