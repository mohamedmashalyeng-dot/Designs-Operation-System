import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session via the Next.js cookie jar.
 *
 * Server Components cannot set cookies (Next.js will throw), so the
 * `setAll` call is wrapped in a try/catch — this is safe as long as a
 * proxy session-refresh (see `src/lib/supabase/proxy.ts`) runs in front
 * of every request and keeps the session cookie fresh.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — the proxy handles refresh.
          }
        },
      },
    }
  );
}

/**
 * Resolves the signed-in user from a verified JWT (local verification when
 * the project uses asymmetric signing keys, falling back to an Auth server
 * round trip otherwise). Prefer this over `auth.getSession()`, which reads
 * an unverified session straight from cookies.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return { id: data.claims.sub, email: data.claims.email as string | undefined };
}

/** Same as `getCurrentUser`, but throws if there is no session. Routes that
 * call this must always sit behind the proxy's protected-route matcher. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: no active session");
  }
  return user;
}
