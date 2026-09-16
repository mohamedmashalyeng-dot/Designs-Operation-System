"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

export interface AuthActionResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInAction(_prev: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUpAction(_prev: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    organisationName: formData.get("organisationName") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organisation_name: parsed.data.organisationName,
      },
    },
  });
  if (error) return { error: error.message };

  if (data.session) {
    redirect("/dashboard");
  }

  return { needsEmailConfirmation: true };
}
