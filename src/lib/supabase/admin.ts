import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * The `server-only` import above makes any accidental client-bundle import
 * fail at build time. Beyond that, use this ONLY for operations that
 * legitimately need to cross organisation boundaries (webhooks, background
 * jobs, admin tooling) — every user-facing query should go through
 * `src/lib/supabase/server.ts` so RLS stays the actual security boundary.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient() requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
