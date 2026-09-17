import "server-only";
import crypto from "node:crypto";

/**
 * Facebook Login OAuth 2.0 against the Meta Graph API. Verified against
 * developers.facebook.com/docs (2026-09), Graph API v25.0.
 *
 * IMPORTANT: `pages_manage_posts` and `instagram_content_publish` /
 * `instagram_business_content_publish` require Advanced Access, which
 * requires Business Verification (reported 10+ day wait) followed by App
 * Review (reported 2-4 weeks) before this works for real, arbitrary
 * accounts. Until that's done, it only works for accounts added as
 * Admin/Developer/Tester on the Meta App itself (Standard Access) — fine
 * for connecting your own Page/Instagram account, not for other
 * businesses'. See src/app/(app)/connections/meta/page.tsx for the
 * user-facing explanation of this gate.
 */

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";

export function generateState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function buildAuthorizationUrl(params: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCodeForUserToken(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("client_secret", params.appSecret);
  url.searchParams.set("code", params.code);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta token exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Short-lived user tokens (~1-2h) exchange for a long-lived one (~60d) —
 * page tokens minted from a long-lived user token don't themselves expire. */
export async function exchangeForLongLivedToken(params: { appId: string; appSecret: string; shortLivedToken: string }): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("client_secret", params.appSecret);
  url.searchParams.set("fb_exchange_token", params.shortLivedToken);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta long-lived token exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface MetaPageRef {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramBusinessAccountId: string | null;
}

/** Returns the first Page the authorising user manages, with its
 * page-scoped access token and linked Instagram Business account (if
 * any). Multi-page selection UI isn't built — most solo/small setups only
 * have one Page, and Business Verification (required for more) is a
 * separate gate anyway. */
export async function fetchFirstManagedPage(userAccessToken: string): Promise<MetaPageRef | null> {
  const res = await fetch(`${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  if (!res.ok) throw new Error(`Meta /me/accounts failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string } }[];
  };
  const page = data.data[0];
  if (!page) return null;

  return {
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
  };
}

export function getMetaOAuthConfig() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri };
}

export { GRAPH_BASE };
