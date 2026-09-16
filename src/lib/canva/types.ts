/**
 * Canva integration — architecture per product spec §17, scoped strictly
 * to what the Canva Connect API actually documents (verified against
 * developers.canva.com/docs/connect on 2026-09-16; re-check before relying
 * on this if it's been a while — Canva's API surface moves).
 *
 * What's real and implemented here:
 *   - OAuth 2.0 Authorization Code + PKCE (`src/lib/canva/oauth.ts`)
 *   - Upload a generated image as a Canva asset, then create a new Canva
 *     design pre-populated with it (`POST /v1/asset-uploads` → poll →
 *     `POST /v1/designs`) — `provider.ts`
 *   - Exporting an edited Canva design back to an image
 *     (`POST /v1/exports` → poll) — `provider.ts`
 *   - Return navigation (`correlation_state` → `correlation_jwt`) per
 *     Canva's return-navigation guide — `return-navigation.ts`
 *
 * What's explicitly NOT implemented (would need more than this app can
 * verify/support right now — see the TODOs at each site):
 *   - Cryptographic verification of the `correlation_jwt` signature
 *     against Canva's published JWKS (the JWT is decoded, not verified —
 *     do not trust its contents for anything security-sensitive until
 *     this is added).
 *   - Brand Template autofill (`POST /v1/autofills`). Canva Brand
 *     Templates must be created manually in the Canva UI first — there is
 *     no API to define one — so this needs a per-organisation setup step
 *     in Brand Brain before it could be wired up, which is out of scope
 *     for this phase.
 *   - Token encryption at rest (`connections.access_token_encrypted`
 *     currently stores the raw token; see the column comment).
 */

export interface CanvaTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface CanvaDesignRef {
  designId: string;
  editUrl: string;
  viewUrl: string;
  thumbnailUrl: string | null;
}

export interface CanvaProvider {
  /** Uploads image bytes to Canva and creates a new design pre-populated
   * with that image, ready for manual editing. */
  createDesignFromImage(params: {
    accessToken: string;
    imageBytes: Buffer;
    mimeType: string;
    fileName: string;
    title: string;
  }): Promise<CanvaDesignRef>;

  /** Exports a (possibly user-edited) Canva design back to a PNG, for
   * syncing changes made in Canva back into our version history. */
  exportDesignAsPng(params: { accessToken: string; designId: string }): Promise<{ url: string }>;
}
