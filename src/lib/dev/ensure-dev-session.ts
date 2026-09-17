import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_BYPASS_EMAIL, DEV_BYPASS_PASSWORD } from "./bypass-auth";

/**
 * Dev-only: when `BYPASS_AUTH` is on and the browser has no real Supabase
 * session, sign it into one real, auto-provisioned account instead of
 * faking a user at the application layer — Postgres RLS checks `auth.uid()`
 * from an actual JWT, so nothing short of a real session makes `campaigns`
 * inserts (or any other write) pass. Auto-provisions the account on first
 * use via the admin API; every request after that just re-authenticates
 * the existing one. Leaves an already-real session (dev or not) untouched.
 */
export async function ensureDevSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) return response;

  const signIn = await supabase.auth.signInWithPassword({
    email: DEV_BYPASS_EMAIL,
    password: DEV_BYPASS_PASSWORD,
  });
  if (!signIn.error) return response;

  try {
    await createAdminClient().auth.admin.createUser({
      email: DEV_BYPASS_EMAIL,
      password: DEV_BYPASS_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Dev User", organisation_name: "Dev Workspace" },
    });
  } catch (error) {
    console.error("Dev bypass: could not provision the dev account", error);
    return response;
  }

  await supabase.auth.signInWithPassword({ email: DEV_BYPASS_EMAIL, password: DEV_BYPASS_PASSWORD });
  return response;
}
