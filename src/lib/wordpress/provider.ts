import "server-only";
import type { WordPressCredentials, WordPressPostRef, WordPressProvider, WordPressSiteInfo } from "./types";

/** Real implementation against the WordPress core REST API
 * (`wp-json/wp/v2`), verified against developer.wordpress.org/rest-api
 * (2026-09). Application Passwords authenticate as HTTP Basic Auth — the
 * password WordPress generates already contains spaces for readability,
 * which Basic Auth handles fine (they're stripped by WordPress itself). */

function normaliseSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function authHeader(creds: WordPressCredentials): string {
  return `Basic ${Buffer.from(`${creds.username}:${creds.applicationPassword}`).toString("base64")}`;
}

function apiBase(creds: WordPressCredentials): string {
  return `${normaliseSiteUrl(creds.siteUrl)}/wp-json/wp/v2`;
}

export class WordPressRestProvider implements WordPressProvider {
  async verifyCredentials(creds: WordPressCredentials): Promise<WordPressSiteInfo> {
    const base = apiBase(creds);

    let userRes: Response;
    let siteRes: Response;
    try {
      [userRes, siteRes] = await Promise.all([
        fetch(`${base}/users/me`, { headers: { Authorization: authHeader(creds) } }),
        fetch(`${normaliseSiteUrl(creds.siteUrl)}/wp-json`),
      ]);
    } catch {
      throw new Error("Couldn't reach that site — check the URL is correct and publicly accessible.");
    }

    if (!userRes.ok) {
      if (userRes.status === 401) throw new Error("WordPress rejected the username/application password.");
      throw new Error(`Couldn't verify WordPress credentials (${userRes.status}). Check the site URL and try again.`);
    }
    const user = (await userRes.json()) as { name?: string };
    const site = siteRes.ok ? ((await siteRes.json()) as { name?: string }) : {};

    return { siteName: site.name ?? new URL(normaliseSiteUrl(creds.siteUrl)).hostname, userDisplayName: user.name ?? creds.username };
  }

  async publishPost(params: {
    creds: WordPressCredentials;
    title: string;
    content: string;
    imageBytes: Buffer;
    imageMimeType: string;
    imageFileName: string;
    status: "publish" | "draft";
  }): Promise<WordPressPostRef> {
    const base = apiBase(params.creds);
    const auth = authHeader(params.creds);

    let mediaRes: Response;
    try {
      mediaRes = await fetch(`${base}/media`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": params.imageMimeType,
          "Content-Disposition": `attachment; filename="${params.imageFileName.replace(/"/g, "")}"`,
        },
        body: new Uint8Array(params.imageBytes),
      });
    } catch {
      throw new Error("Couldn't reach the WordPress site to publish — check it's still online and reachable.");
    }
    if (!mediaRes.ok) {
      throw new Error(`WordPress rejected the image upload (${mediaRes.status}): ${await mediaRes.text()}`);
    }
    const media = (await mediaRes.json()) as { id: number };

    const postRes = await fetch(`${base}/posts`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: params.title,
        content: params.content,
        status: params.status,
        featured_media: media.id,
      }),
    });
    if (!postRes.ok) {
      throw new Error(`WordPress rejected the post (${postRes.status}): ${await postRes.text()}`);
    }
    const post = (await postRes.json()) as { id: number; link: string };

    return {
      postId: post.id,
      editUrl: `${normaliseSiteUrl(params.creds.siteUrl)}/wp-admin/post.php?post=${post.id}&action=edit`,
      viewUrl: post.link,
    };
  }
}
