"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import type { ActionResult } from "./campaigns";

const profileSchema = z.object({ fullName: z.string().trim().min(1, "Name is required").max(100) });
const organisationSchema = z.object({ organisationId: z.string().uuid(), name: z.string().trim().min(1, "Name is required").max(120) });

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function updateOrganisationAction(input: unknown): Promise<ActionResult> {
  const parsed = organisationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ name: parsed.data.name }).eq("id", parsed.data.organisationId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}
