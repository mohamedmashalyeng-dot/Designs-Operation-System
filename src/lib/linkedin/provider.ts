import "server-only";
import type { LinkedInPostRef, LinkedInProvider } from "./types";

/**
 * LinkedIn Posts API (Community Management API family — replaced the
 * legacy `ugcPosts` endpoint, retired June 2023). Verified against
 * LinkedIn's Posts/Images API docs (2026-09):
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
 *
 * LINKEDIN_API_VERSION is a monthly "YYYYMM" string LinkedIn requires on
 * every call — theirs move forward regularly, so this is env-overridable
 * rather than hardcoded; re-check developer.linkedin.com if calls start
 * failing with a version-related error.
 */

const API_BASE = "https://api.linkedin.com/rest";
const API_VERSION = process.env.LINKEDIN_API_VERSION || "202509";

function headers(accessToken: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Linkedin-Version": API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

async function uploadImage(params: { accessToken: string; authorUrn: string; imageBytes: Buffer; imageMimeType: string }): Promise<string> {
  const initRes = await fetch(`${API_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(params.accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner: params.authorUrn } }),
  });
  if (!initRes.ok) {
    throw new Error(`LinkedIn image upload init failed (${initRes.status}): ${await initRes.text()}`);
  }
  const init = (await initRes.json()) as { value: { uploadUrl: string; image: string } };

  const uploadRes = await fetch(init.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": params.imageMimeType },
    body: new Uint8Array(params.imageBytes),
  });
  if (!uploadRes.ok) {
    throw new Error(`LinkedIn image binary upload failed (${uploadRes.status})`);
  }

  return init.value.image;
}

export class LinkedInPostsProvider implements LinkedInProvider {
  async publishPost(params: {
    accessToken: string;
    authorUrn: string;
    commentary: string;
    imageBytes: Buffer;
    imageMimeType: string;
    altText: string;
  }): Promise<LinkedInPostRef> {
    const imageUrn = await uploadImage({
      accessToken: params.accessToken,
      authorUrn: params.authorUrn,
      imageBytes: params.imageBytes,
      imageMimeType: params.imageMimeType,
    });

    const postRes = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: headers(params.accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        author: params.authorUrn,
        commentary: params.commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        content: { media: { id: imageUrn, altText: params.altText.slice(0, 100) } },
      }),
    });
    if (!postRes.ok) {
      throw new Error(`LinkedIn post creation failed (${postRes.status}): ${await postRes.text()}`);
    }
    // LinkedIn returns the created post's URN in the x-restli-id response header, not the JSON body.
    const postUrn = postRes.headers.get("x-restli-id") ?? postRes.headers.get("x-linkedin-id") ?? "";
    if (!postUrn) throw new Error("LinkedIn accepted the post but returned no post id header");

    return { postUrn, viewUrl: `https://www.linkedin.com/feed/update/${postUrn}/` };
  }
}
