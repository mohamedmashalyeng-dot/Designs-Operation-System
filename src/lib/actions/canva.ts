"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { disconnectCanva, openDesignInCanva, syncDesignFromCanva } from "@/lib/canva/service";
import type { ActionResult } from "./campaigns";

export async function openInCanvaAction(designId: string): Promise<ActionResult & { url?: string }> {
  await requireUser();
  const supabase = await createClient();
  try {
    const { url } = await openDesignInCanva(supabase, designId);
    revalidatePath(`/review/${designId}`);
    return { url };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to open in Canva" };
  }
}

export async function syncFromCanvaAction(designId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  try {
    await syncDesignFromCanva(supabase, { designId, userId: user.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to sync from Canva" };
  }
  revalidatePath(`/review/${designId}`);
  revalidatePath("/review");
  return {};
}

export async function disconnectCanvaAction(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "No workspace found" };

  await disconnectCanva(membership.organisation_id);
  revalidatePath("/connections/canva");
  return {};
}
