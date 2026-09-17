import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { WordPressRestProvider } from "./provider";
import type { WordPressCredentials } from "./types";
import type { PublishParams, PublishResult } from "@/lib/publishing/types";

const provider = new WordPressRestProvider();

function credsFromConnection(connection: Tables<"connections">): WordPressCredentials {
  const metadata = connection.metadata as { siteUrl?: string; username?: string };
  if (!metadata.siteUrl || !metadata.username || !connection.access_token_encrypted) {
    throw new Error("WordPress connection is missing credentials — reconnect it under Connections → Website.");
  }
  return { siteUrl: metadata.siteUrl, username: metadata.username, applicationPassword: connection.access_token_encrypted };
}

export async function connectWordPress(
  supabase: SupabaseClient<Database>,
  params: { organisationId: string; siteUrl: string; username: string; applicationPassword: string }
): Promise<{ siteName: string }> {
  const creds: WordPressCredentials = {
    siteUrl: params.siteUrl,
    username: params.username,
    applicationPassword: params.applicationPassword,
  };
  const info = await provider.verifyCredentials(creds);

  const admin = createAdminClient();
  const { error } = await admin.from("connections").upsert(
    {
      organisation_id: params.organisationId,
      provider: "website",
      status: "connected",
      external_account_id: creds.siteUrl,
      external_account_name: info.siteName,
      access_token_encrypted: creds.applicationPassword,
      refresh_token_encrypted: null,
      expires_at: null,
      metadata: { siteUrl: creds.siteUrl, username: creds.username },
    },
    { onConflict: "organisation_id,provider" }
  );
  if (error) throw new Error(`Failed to save the connection: ${error.message}`);

  return { siteName: info.siteName };
}

export async function disconnectWordPress(organisationId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("connections")
    .update({ status: "disconnected", access_token_encrypted: null, refresh_token_encrypted: null, metadata: {} })
    .eq("organisation_id", organisationId)
    .eq("provider", "website");
}

/** Matches the `Publisher` signature in `src/lib/publishing/index.ts`. */
export async function publishToWordPress(connection: Tables<"connections">, params: PublishParams): Promise<PublishResult> {
  const creds = credsFromConnection(connection);
  const content = params.cta ? `<p>${params.supportingCopy}</p><p><strong>${params.cta}</strong></p>` : `<p>${params.supportingCopy}</p>`;

  const post = await provider.publishPost({
    creds,
    title: params.headline,
    content,
    imageBytes: params.imageBytes,
    imageMimeType: params.imageMimeType,
    imageFileName: params.imageFileName,
    status: "publish",
  });

  return { externalPostId: String(post.postId), externalUrl: post.viewUrl };
}
