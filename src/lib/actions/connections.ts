"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { connectWordPress, disconnectWordPress } from "@/lib/wordpress/service";
import { disconnectLinkedIn } from "@/lib/linkedin/service";
import { disconnectMeta } from "@/lib/meta/service";
import { publishNow, scheduleForLater, retryJob, cancelJob, rescheduleJob } from "@/lib/publishing/service";
import { connectWordPressSchema, jobIdSchema, publishNowSchema, rescheduleJobSchema, scheduleSchema } from "@/lib/validation/connections";
import type { ActionResult } from "./campaigns";

async function currentOrganisationId(): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error("No workspace found for your account.");
  return membership.organisation_id;
}

export async function connectWordPressAction(input: unknown): Promise<ActionResult> {
  const parsed = connectWordPressSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    const organisationId = await currentOrganisationId();
    await connectWordPress(supabase, { organisationId, ...parsed.data });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to connect WordPress" };
  }
  revalidatePath("/connections/website");
  return {};
}

export async function disconnectWebsiteAction(): Promise<ActionResult> {
  try {
    await disconnectWordPress(await currentOrganisationId());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to disconnect" };
  }
  revalidatePath("/connections/website");
  return {};
}

export async function disconnectLinkedInAction(): Promise<ActionResult> {
  try {
    await disconnectLinkedIn(await currentOrganisationId());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to disconnect" };
  }
  revalidatePath("/connections/linkedin");
  return {};
}

export async function disconnectMetaAction(): Promise<ActionResult> {
  try {
    await disconnectMeta(await currentOrganisationId());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to disconnect" };
  }
  revalidatePath("/connections/meta");
  return {};
}

export async function publishNowAction(input: unknown): Promise<ActionResult & { externalUrl?: string }> {
  const parsed = publishNowSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    const { externalUrl } = await publishNow(supabase, parsed.data);
    revalidatePath(`/review/${parsed.data.designId}`);
    revalidatePath("/published");
    revalidatePath("/dashboard");
    return { externalUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to publish" };
  }
}

export async function scheduleAction(input: unknown): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    await scheduleForLater(supabase, { designId: parsed.data.designId, channel: parsed.data.channel, scheduledFor: new Date(parsed.data.scheduledFor) });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to schedule" };
  }
  revalidatePath(`/review/${parsed.data.designId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return {};
}

export async function retryJobAction(input: unknown): Promise<ActionResult & { externalUrl?: string }> {
  const parsed = jobIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    const { externalUrl } = await retryJob(supabase, parsed.data.jobId);
    revalidatePath("/calendar");
    revalidatePath("/published");
    return { externalUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Retry failed" };
  }
}

export async function cancelJobAction(input: unknown): Promise<ActionResult> {
  const parsed = jobIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    await cancelJob(supabase, parsed.data.jobId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to cancel" };
  }
  revalidatePath("/calendar");
  return {};
}

export async function rescheduleJobAction(input: unknown): Promise<ActionResult> {
  const parsed = rescheduleJobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    await rescheduleJob(supabase, parsed.data.jobId, new Date(parsed.data.scheduledFor));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reschedule" };
  }
  revalidatePath("/calendar");
  return {};
}
