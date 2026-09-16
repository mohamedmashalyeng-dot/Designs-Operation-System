import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/supabase/server";
import { buildAuthorizationUrl, generatePkcePair, generateState, getCanvaOAuthConfig } from "@/lib/canva/oauth";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export async function GET(request: NextRequest) {
  await requireUser();

  const config = getCanvaOAuthConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/connections/canva?error=not_configured", request.url));
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateState();

  const cookieStore = await cookies();
  cookieStore.set("canva_oauth_verifier", codeVerifier, COOKIE_OPTIONS);
  cookieStore.set("canva_oauth_state", state, COOKIE_OPTIONS);

  const authorizationUrl = buildAuthorizationUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(authorizationUrl);
}
