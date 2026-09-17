import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireUser, createClient } from "@/lib/supabase/server";
import { getLinkedInOAuthConfig } from "@/lib/linkedin/oauth";
import { completeLinkedInConnection } from "@/lib/linkedin/service";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const redirectBase = new URL("/connections/linkedin", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("linkedin_oauth_state")?.value;
  cookieStore.delete("linkedin_oauth_state");

  if (oauthError) {
    redirectBase.searchParams.set("error", oauthError === "user_cancelled_login" || oauthError === "user_cancelled_authorize" ? "access_denied" : oauthError);
    return NextResponse.redirect(redirectBase);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    redirectBase.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  const config = getLinkedInOAuthConfig();
  if (!config) {
    redirectBase.searchParams.set("error", "not_configured");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("No organisation found for this user");

    await completeLinkedInConnection(supabase, {
      organisationId: membership.organisation_id,
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    redirectBase.searchParams.set("connected", "1");
    return NextResponse.redirect(redirectBase);
  } catch (error) {
    console.error("LinkedIn OAuth callback failed:", error);
    redirectBase.searchParams.set("error", "exchange_failed");
    return NextResponse.redirect(redirectBase);
  }
}
