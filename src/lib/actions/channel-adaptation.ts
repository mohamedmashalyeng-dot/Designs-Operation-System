"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { prepareCampaignChannels } from "@/lib/creative/channel-adaptation";
import { prepareCampaignSchema } from "@/lib/validation/channel-adaptation";
import type { ActionResult } from "./campaigns";

export async function prepareCampaignAction(input: unknown): Promise<ActionResult> {
  const parsed = prepareCampaignSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();

  const { succeeded, failed } = await prepareCampaignChannels(supabase, parsed.data);

  if (succeeded.length === 0) {
    return { error: failed[0]?.error ?? "Failed to prepare any channel versions." };
  }

  revalidatePath(`/review/${parsed.data.masterDesignId}`);
  const failedParam = failed.length ? `?failed=${encodeURIComponent(failed.map((f) => f.channel).join(","))}` : "";
  redirect(`/review/${parsed.data.masterDesignId}/channels${failedParam}`);
}
