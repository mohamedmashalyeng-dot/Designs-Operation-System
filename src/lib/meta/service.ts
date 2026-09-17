import "server-only";
import type { Tables } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForUserToken, exchangeForLongLivedToken, fetchFirstManagedPage } from "./oauth";
import { MetaGraphProvider } from "./provider";
import type { PublishParams, PublishResult } from "@/lib/publishing/types";

const provider = new MetaGraphProvider();

export async function completeMetaConnection(
  params: { organisationId: string; code: string; appId: string; appSecret: string; redirectUri: string }
): Promise<{ pageName: string; hasInstagram: boolean }> {
  const shortLivedToken = await exchangeCodeForUserToken(params);
  const longLivedToken = await exchangeForLongLivedToken({
    appId: params.appId,
    appSecret: params.appSecret,
    shortLivedToken,
  });
  const page = await fetchFirstManagedPage(longLivedToken);
  if (!page) {
    throw new Error(
      "No Facebook Page found for this account. You need to manage at least one Page to connect Meta — create one at facebook.com/pages/create first."
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("connections").upsert(
    {
      organisation_id: params.organisationId,
      provider: "meta",
      status: "connected",
      external_account_id: page.pageId,
      external_account_name: page.pageName,
      access_token_encrypted: page.pageAccessToken,
      refresh_token_encrypted: null,
      expires_at: null, // page tokens minted from a long-lived user token don't expire
      metadata: { pageId: page.pageId, instagramBusinessAccountId: page.instagramBusinessAccountId },
    },
    { onConflict: "organisation_id,provider" }
  );
  if (error) throw new Error(`Failed to save the connection: ${error.message}`);

  return { pageName: page.pageName, hasInstagram: Boolean(page.instagramBusinessAccountId) };
}

export async function disconnectMeta(organisationId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("connections")
    .update({ status: "disconnected", access_token_encrypted: null, metadata: {} })
    .eq("organisation_id", organisationId)
    .eq("provider", "meta");
}

function metaCreds(connection: Tables<"connections">) {
  const metadata = connection.metadata as { pageId?: string; instagramBusinessAccountId?: string | null };
  if (!connection.access_token_encrypted || !metadata.pageId) {
    throw new Error("Meta connection is missing credentials — reconnect it under Connections → Meta.");
  }
  return { pageAccessToken: connection.access_token_encrypted, pageId: metadata.pageId, instagramBusinessAccountId: metadata.instagramBusinessAccountId ?? null };
}

function buildCaption(params: PublishParams): string {
  return params.cta ? `${params.headline}\n\n${params.supportingCopy}\n\n${params.cta}` : `${params.headline}\n\n${params.supportingCopy}`;
}

/** Matches the `Publisher` signature in `src/lib/publishing/index.ts` for
 * channel "facebook". Requires `params.imageUrl` (a publicly fetchable
 * signed URL) rather than raw bytes — see provider.ts. */
export async function publishToFacebook(connection: Tables<"connections">, params: PublishParams): Promise<PublishResult> {
  const creds = metaCreds(connection);
  if (!params.imageUrl) throw new Error("A signed image URL is required to publish to Facebook.");
  const post = await provider.publishToFacebookPage({
    pageId: creds.pageId,
    pageAccessToken: creds.pageAccessToken,
    caption: buildCaption(params),
    imageUrl: params.imageUrl,
  });
  return { externalPostId: post.externalPostId, externalUrl: post.viewUrl };
}

/** Matches the `Publisher` signature for channel "instagram". */
export async function publishToInstagram(connection: Tables<"connections">, params: PublishParams): Promise<PublishResult> {
  const creds = metaCreds(connection);
  if (!creds.instagramBusinessAccountId) {
    throw new Error("No Instagram Business account is linked to the connected Facebook Page.");
  }
  if (!params.imageUrl) throw new Error("A signed image URL is required to publish to Instagram.");
  const post = await provider.publishToInstagram({
    instagramUserId: creds.instagramBusinessAccountId,
    pageAccessToken: creds.pageAccessToken,
    caption: buildCaption(params),
    imageUrl: params.imageUrl,
  });
  return { externalPostId: post.externalPostId, externalUrl: post.viewUrl };
}
