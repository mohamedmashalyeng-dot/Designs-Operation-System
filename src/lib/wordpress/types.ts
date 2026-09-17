/**
 * WordPress integration — uses the WordPress REST API (`wp-json/wp/v2`)
 * with Application Passwords (core WP feature since 5.6, HTTP Basic Auth
 * over the username + a generated application password). No OAuth app
 * registration or review needed, which is why this is the one publishing
 * channel that ships as a real integration in this phase — LinkedIn and
 * Meta both require a registered developer app and, for LinkedIn, partner
 * approval for posting scopes (see src/lib/linkedin, src/lib/meta once
 * those credentials exist).
 *
 * Only self-hosted WordPress (or otherwise REST-API-reachable) sites work
 * this way — WordPress.com-hosted sites use a different OAuth-based flow
 * and are out of scope here.
 */

export interface WordPressCredentials {
  /** Normalised, no trailing slash, e.g. "https://example.com". */
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressSiteInfo {
  siteName: string;
  userDisplayName: string;
}

export interface WordPressPostRef {
  postId: number;
  editUrl: string;
  viewUrl: string;
}

export interface WordPressProvider {
  /** Confirms the site is reachable and the credentials work. */
  verifyCredentials(creds: WordPressCredentials): Promise<WordPressSiteInfo>;
  publishPost(params: {
    creds: WordPressCredentials;
    title: string;
    content: string;
    imageBytes: Buffer;
    imageMimeType: string;
    imageFileName: string;
    status: "publish" | "draft";
  }): Promise<WordPressPostRef>;
}
