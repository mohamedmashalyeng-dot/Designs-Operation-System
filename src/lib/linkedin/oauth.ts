import "server-only";
import crypto from "node:crypto";

/**
 * OAuth 2.0 Authorization Code against LinkedIn (standard 3-legged flow,
 * no PKCE — unlike Canva, LinkedIn's OAuth doesn't require or support it).
 * Endpoints verified against LinkedIn's Community Management API docs
 * (2026-09) — see src/lib/linkedin/README in spirit of src/lib/canva/types.ts.
 *
 * Scopes: `openid profile` to resolve the member's URN for `author`,
 * `w_member_social` to post on their behalf. This only ever posts to the
 * connected member's own profile — posting to a LinkedIn Company Page
 * needs `w_organization_social`, which requires a separate LinkedIn app
 * review (access-request form + demo + sign-off call) and isn't wired up.
 */

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export const LINKEDIN_SCOPES = "openid profile w_member_social";

export function generateState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function buildAuthorizationUrl(params: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", LINKEDIN_SCOPES);
  return url.toString();
}

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn token request failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as LinkedInTokenResponse;
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export async function fetchMemberUrn(accessToken: string): Promise<{ urn: string; name: string }> {
  const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new Error(`LinkedIn userinfo request failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { sub: string; name: string };
  return { urn: `urn:li:person:${data.sub}`, name: data.name };
}

export function getLinkedInOAuthConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
