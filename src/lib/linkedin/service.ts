import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMemberUrn, exchangeCodeForToken } from "./oauth";
import { LinkedInPostsProvider } from "./provider";
import type { PublishParams, PublishResult } from "@/lib/publishing/types";

const provider = new LinkedInPostsProvider();

export async function completeLinkedInConnection(
  supabase: SupabaseClient<Database>,
  params: { organisationId: string; code: string; clientId: string; clientSecret: string; redirectUri: string }
): Promise<{ memberName: string }> {
  const token = await exchangeCodeForToken({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    code: params.code,
    redirectUri: params.redirectUri,
  });
  const member = await fetchMemberUrn(token.accessToken);

  const admin = createAdminClient();
  const { error } = await admin.from("connections").upsert(
    {
      organisation_id: params.organisationId,
      provider: "linkedin",
      status: "connected",
      external_account_id: member.urn,
      external_account_name: member.name,
      access_token_encrypted: token.accessToken,
      refresh_token_encrypted: null,
      expires_at: token.expiresAt.toISOString(),
      // LinkedIn's standard tier doesn't issue refresh tokens — the member
      // reconnects (repeats OAuth) when this expires, typically ~60 days.
      metadata: { authorUrn: member.urn },
    },
    { onConflict: "organisation_id,provider" }
  );
  if (error) throw new Error(`Failed to save the connection: ${error.message}`);

  return { memberName: member.name };
}

export async function disconnectLinkedIn(organisationId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("connections")
    .update({ status: "disconnected", access_token_encrypted: null, metadata: {} })
    .eq("organisation_id", organisationId)
    .eq("provider", "linkedin");
}

/** Matches the `Publisher` signature in `src/lib/publishing/index.ts`.
 * Posts to the connected member's own profile only — see the scope note
 * in src/lib/linkedin/oauth.ts for why Company Pages aren't supported. */
export async function publishToLinkedIn(connection: Tables<"connections">, params: PublishParams): Promise<PublishResult> {
  const metadata = connection.metadata as { authorUrn?: string };
  if (!connection.access_token_encrypted || !metadata.authorUrn) {
    throw new Error("LinkedIn connection is missing credentials — reconnect it under Connections → LinkedIn.");
  }
  if (connection.expires_at && new Date(connection.expires_at).getTime() < Date.now()) {
    throw new Error("LinkedIn connection has expired — reconnect it under Connections → LinkedIn.");
  }

  const commentary = params.cta ? `${params.headline}\n\n${params.supportingCopy}\n\n${params.cta}` : `${params.headline}\n\n${params.supportingCopy}`;

  const post = await provider.publishPost({
    accessToken: connection.access_token_encrypted,
    authorUrn: metadata.authorUrn,
    commentary,
    imageBytes: params.imageBytes,
    imageMimeType: params.imageMimeType,
    altText: params.headline,
  });

  return { externalPostId: post.postUrn, externalUrl: post.viewUrl };
}
