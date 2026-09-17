import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireUser, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForToken, getCanvaOAuthConfig } from "@/lib/canva/oauth";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const redirectBase = new URL("/connections/canva", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("canva_oauth_state")?.value;
  const codeVerifier = cookieStore.get("canva_oauth_verifier")?.value;
  cookieStore.delete("canva_oauth_state");
  cookieStore.delete("canva_oauth_verifier");

  if (oauthError) {
    redirectBase.searchParams.set("error", oauthError);
    return NextResponse.redirect(redirectBase);
  }
  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    redirectBase.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  const config = getCanvaOAuthConfig();
  if (!config) {
    redirectBase.searchParams.set("error", "not_configured");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const tokens = await exchangeCodeForToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      codeVerifier,
      redirectUri: config.redirectUri,
    });

    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("No organisation found for this user");

    const admin = createAdminClient();
    const { error: saveError } = await admin.from("connections").upsert(
      {
        organisation_id: membership.organisation_id,
        provider: "canva",
        status: "connected",
        access_token_encrypted: tokens.accessToken,
        refresh_token_encrypted: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        metadata: {},
      },
      { onConflict: "organisation_id,provider" }
    );
    if (saveError) {
      console.error("Canva connection could not be saved:", saveError.code);
      redirectBase.searchParams.set("error", "save_failed");
      return NextResponse.redirect(redirectBase);
    }

    redirectBase.searchParams.set("connected", "1");
    return NextResponse.redirect(redirectBase);
  } catch (error) {
    console.error("Canva OAuth callback failed:", error);
    redirectBase.searchParams.set("error", "exchange_failed");
    return NextResponse.redirect(redirectBase);
  }
}
