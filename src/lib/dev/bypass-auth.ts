/**
 * Local-only convenience: skip requiring a real Supabase session so the
 * app shell/UI can be worked on before a real project is connected.
 *
 * Guarded on both sides — `NODE_ENV !== "production"` AND an explicit
 * opt-in flag — so this can never activate in a real deployment even if
 * `BYPASS_AUTH` leaks into a production environment's env vars by
 * accident. Used by `src/proxy.ts` (skips the redirect-to-/login gate)
 * and `src/app/(app)/layout.tsx` (renders the shell with a placeholder
 * "Dev User" when there's no real session). Never affects RLS or actual
 * data access — Supabase queries still need real project credentials to
 * return anything.
 */
export function isAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.BYPASS_AUTH === "true";
}

export const DEV_USER = { id: "00000000-0000-0000-0000-000000000000", email: "dev@localhost" };
