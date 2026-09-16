import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RejectionReason, Tables } from "@/types/database";

/**
 * Approve/reject/feedback actions. Kept deliberately thin (a couple of
 * inserts and a status update each) — the interesting logic lives in
 * `designs.ts` (generation/versioning) and the AI layer. Rejection
 * reasons are a closed enum specifically so they can be aggregated later
 * as a learning signal (product spec §15/§26); `comment` is the free-text
 * escape hatch.
 */

export async function approveDesign(
  supabase: SupabaseClient<Database>,
  params: { designId: string; userId: string }
): Promise<Tables<"designs">> {
  const { data: design, error } = await supabase.from("designs").select("*").eq("id", params.designId).single();
  if (error || !design) throw new Error("Design not found");
  if (!design.current_version_id) throw new Error("Design has no version to approve");

  await supabase.from("approvals").insert({
    design_id: design.id,
    design_version_id: design.current_version_id,
    user_id: params.userId,
    status: "approved",
  });

  const { data: updated, error: updateError } = await supabase
    .from("designs")
    .update({ status: "approved" })
    .eq("id", design.id)
    .select()
    .single();
  if (updateError || !updated) throw new Error(updateError?.message ?? "Failed to approve design");
  return updated;
}

export async function rejectDesign(
  supabase: SupabaseClient<Database>,
  params: { designId: string; userId: string; reasons: RejectionReason[]; comment?: string }
): Promise<Tables<"designs">> {
  const { data: design, error } = await supabase.from("designs").select("*").eq("id", params.designId).single();
  if (error || !design) throw new Error("Design not found");

  await supabase.from("feedback").insert({
    design_id: design.id,
    design_version_id: design.current_version_id,
    user_id: params.userId,
    type: "rejection",
    reasons: params.reasons,
    comment: params.comment ?? null,
  });

  if (design.current_version_id) {
    await supabase.from("approvals").insert({
      design_id: design.id,
      design_version_id: design.current_version_id,
      user_id: params.userId,
      status: "rejected",
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("designs")
    .update({ status: "rejected" })
    .eq("id", design.id)
    .select()
    .single();
  if (updateError || !updated) throw new Error(updateError?.message ?? "Failed to reject design");
  return updated;
}

export async function addFeedbackComment(
  supabase: SupabaseClient<Database>,
  params: { designId: string; userId: string; comment: string }
): Promise<Tables<"feedback">> {
  const { data: design, error } = await supabase.from("designs").select("*").eq("id", params.designId).single();
  if (error || !design) throw new Error("Design not found");

  const { data: feedback, error: insertError } = await supabase
    .from("feedback")
    .insert({
      design_id: design.id,
      design_version_id: design.current_version_id,
      user_id: params.userId,
      type: "comment",
      comment: params.comment,
    })
    .select()
    .single();
  if (insertError || !feedback) throw new Error(insertError?.message ?? "Failed to save feedback");
  return feedback;
}
