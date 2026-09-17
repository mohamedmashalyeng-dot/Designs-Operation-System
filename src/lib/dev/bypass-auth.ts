/**
 * Local-only convenience: skip requiring a real login so the app can be
 * worked on end-to-end (including Server Actions that write to Supabase)
 * before a real login flow has been used.
 *
 * Guarded on both sides — `NODE_ENV !== "production"` AND an explicit
 * opt-in flag — so this can never activate in a real deployment even if
 * `BYPASS_AUTH` leaks into a production environment's env vars by
 * accident.
 *
 * `src/proxy.ts` uses this to transparently sign the browser into one
 * real, auto-provisioned Supabase account (see `ensure-dev-session.ts`)
 * instead of faking a user at the application layer — RLS checks
 * `auth.uid()` from a real JWT, so a fake app-level user id would just
 * get every write rejected. `src/app/(app)/layout.tsx` also falls back to
 * `DEV_USER` as a last-resort placeholder for rendering only (e.g. before
 * the proxy has run once), but the real session is what makes data
 * actually persist.
 */
export function isAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.BYPASS_AUTH === "true";
}

export const DEV_USER = { id: "00000000-0000-0000-0000-000000000000", email: "dev@localhost" };

/** Credentials for the real auto-provisioned dev account (see
 * `ensure-dev-session.ts`). Overridable via env; safe defaults otherwise
 * since this account only ever exists in a dev-only Supabase project. */
export const DEV_BYPASS_EMAIL = process.env.DEV_BYPASS_EMAIL || "dev-bypass@creative-ops.local";
export const DEV_BYPASS_PASSWORD = process.env.DEV_BYPASS_PASSWORD || "DevBypass!Local2026";
