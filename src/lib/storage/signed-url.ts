import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Signed URLs are generated through the user's own Supabase client, so
 * storage RLS still governs who can read what — nothing here bypasses it. */
export async function getSignedUrl(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Failed to sign URL for ${bucket}/${path}: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}

/** Batch-signs multiple paths in one bucket in a single request. Returns a
 * `path -> signedUrl` map; paths that failed to sign (e.g. missing object)
 * are simply omitted rather than failing the whole batch. */
export async function getSignedUrls(
  supabase: SupabaseClient<Database>,
  bucket: string,
  paths: string[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresInSeconds);
  if (error || !data) return new Map();
  return new Map(
    data
      .filter((entry): entry is typeof entry & { signedUrl: string; path: string } => Boolean(entry.signedUrl && entry.path))
      .map((entry) => [entry.path, entry.signedUrl])
  );
}
