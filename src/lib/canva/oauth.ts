import "server-only";
import crypto from "node:crypto";

/**
 * OAuth 2.0 Authorization Code + PKCE against the Canva Connect API.
 * Endpoints and parameter names verified against
 * canva.dev/docs/connect/authentication (2026-09-16).
 */

const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

// asset:write — upload the generated image as a Canva asset.
// design:content:write — create a design pre-populated with that asset.
// design:content:read — read design/export state for the return-sync.
export const CANVA_SCOPES = "asset:write design:content:write design:content:read";

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = base64url(crypto.randomBytes(64)).slice(0, 128);
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return base64url(crypto.randomBytes(24));
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", CANVA_SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function postToken(
  clientId: string,
  clientSecret: string,
  body: URLSearchParams
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Canva token request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as CanvaTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  return postToken(
    params.clientId,
    params.clientSecret,
    new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    })
  );
}

export async function refreshCanvaToken(params: { clientId: string; clientSecret: string; refreshToken: string }) {
  return postToken(
    params.clientId,
    params.clientSecret,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: params.refreshToken })
  );
}

export function getCanvaOAuthConfig() {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
