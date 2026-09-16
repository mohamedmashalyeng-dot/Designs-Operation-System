"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createCampaignSchema } from "@/lib/validation/campaign";
import { generateCreativeBrief } from "@/lib/creative/briefs";
import { generateCreativeConcepts } from "@/lib/creative/concepts";

export interface ActionResult {
  error?: string;
}

async function getOrganisationId(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("No organisation found for this user");
  return data.organisation_id;
}

/**
 * Creates a campaign AND generates its first creative brief in one action,
 * so "Create Campaign" is a single button press with one loading state —
 * the brief is an internal structuring step, not a separate user beat
 * (product spec §24: the user-facing checkpoints start at "review ideas",
 * i.e. concepts).
 */
export async function createCampaign(input: unknown): Promise<ActionResult & { campaignId?: string }> {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await requireUser();
  const supabase = await createClient();

  let organisationId: string;
  try {
    organisationId = await getOrganisationId(supabase, user.id);
  } catch {
    return { error: "No workspace found for your account. Try signing out and back in." };
  }

  const title = parsed.data.rawPrompt.slice(0, 80);

  const { data: campaign, error: insertError } = await supabase
    .from("campaigns")
    .insert({
      organisation_id: organisationId,
      created_by: user.id,
      title,
      raw_prompt: parsed.data.rawPrompt,
      objective: parsed.data.objective,
      audience_type: parsed.data.audienceType,
      channels: parsed.data.channels,
    })
    .select()
    .single();

  if (insertError || !campaign) {
    return { error: insertError?.message ?? "Failed to create campaign" };
  }

  try {
    await generateCreativeBrief(supabase, campaign.id);
  } catch (error) {
    // The campaign exists even if the brief failed — the campaign page
    // offers a retry rather than losing the user's input.
    console.error("Brief generation failed:", error);
  }

  revalidatePath("/dashboard");
  redirect(`/campaigns/${campaign.id}`);
}

export async function retryBriefGeneration(campaignId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  try {
    await generateCreativeBrief(supabase, campaignId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate brief" };
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function generateConceptsAction(campaignId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  try {
    await generateCreativeConcepts(supabase, campaignId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate concepts" };
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}
