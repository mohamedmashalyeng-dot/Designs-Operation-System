import "server-only";
import { GRAPH_BASE } from "./oauth";
import type { MetaPostRef, MetaProvider } from "./types";

/**
 * Meta Graph API publishing, verified against
 * developers.facebook.com/docs/instagram-platform/content-publishing/ and
 * the Pages Photos endpoint docs (2026-09). Both flows take a publicly
 * fetchable `image_url` (a Supabase signed URL) rather than a direct
 * upload — required for Instagram, used for consistency on Facebook too.
 */
export class MetaGraphProvider implements MetaProvider {
  async publishToFacebookPage(params: { pageId: string; pageAccessToken: string; caption: string; imageUrl: string }): Promise<MetaPostRef> {
    const res = await fetch(`${GRAPH_BASE}/${params.pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: params.imageUrl, caption: params.caption, access_token: params.pageAccessToken }),
    });
    if (!res.ok) throw new Error(`Facebook Page post failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { id: string; post_id?: string };
    const postId = data.post_id ?? data.id;

    const permalink = await fetchPermalink(data.id, params.pageAccessToken);
    return { externalPostId: postId, viewUrl: permalink ?? `https://www.facebook.com/${postId}` };
  }

  async publishToInstagram(params: { instagramUserId: string; pageAccessToken: string; caption: string; imageUrl: string }): Promise<MetaPostRef> {
    const createRes = await fetch(`${GRAPH_BASE}/${params.instagramUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: params.imageUrl, caption: params.caption, access_token: params.pageAccessToken }),
    });
    if (!createRes.ok) throw new Error(`Instagram media creation failed (${createRes.status}): ${await createRes.text()}`);
    const created = (await createRes.json()) as { id: string };

    const publishRes = await fetch(`${GRAPH_BASE}/${params.instagramUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: created.id, access_token: params.pageAccessToken }),
    });
    if (!publishRes.ok) throw new Error(`Instagram publish failed (${publishRes.status}): ${await publishRes.text()}`);
    const published = (await publishRes.json()) as { id: string };

    const permalink = await fetchPermalink(published.id, params.pageAccessToken);
    return { externalPostId: published.id, viewUrl: permalink ?? `https://www.instagram.com/` };
  }
}

/** Both Page photos and Instagram media expose `permalink`/`permalink_url`
 * — fetched separately since neither publish call returns it directly. */
async function fetchPermalink(objectId: string, accessToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH_BASE}/${objectId}?fields=permalink_url,permalink&access_token=${accessToken}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { permalink_url?: string; permalink?: string };
  return data.permalink_url ?? data.permalink ?? null;
}
