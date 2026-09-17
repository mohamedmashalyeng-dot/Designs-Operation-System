import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isAuthBypassEnabled } from "@/lib/dev/bypass-auth";
import { ensureDevSession } from "@/lib/dev/ensure-dev-session";

export function proxy(request: NextRequest) {
  if (isAuthBypassEnabled()) {
    return ensureDevSession(request);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
