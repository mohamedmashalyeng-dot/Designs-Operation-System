import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/supabase/server";
import { buildAuthorizationUrl, generateState, getMetaOAuthConfig } from "@/lib/meta/oauth";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function GET(request: NextRequest) {
  await requireUser();

  const config = getMetaOAuthConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/connections/meta?error=not_configured", request.url));
  }

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set("meta_oauth_state", state, COOKIE_OPTIONS);

  const authorizationUrl = buildAuthorizationUrl({ appId: config.appId, redirectUri: config.redirectUri, state });
  return NextResponse.redirect(authorizationUrl);
}
