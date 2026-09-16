import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Downloads a stored object and returns it base64-encoded — used to feed
 * an existing generated image back into `ImageProvider.edit()`. Uses the
 * admin client since this runs during AI-edit generation, the same trust
 * boundary as the initial upload. */
export async function downloadAsBase64(
  admin: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ base64: string; mimeType: string }> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Failed to download ${bucket}/${path}: ${error?.message ?? "unknown error"}`);
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType: data.type || "image/png" };
}
