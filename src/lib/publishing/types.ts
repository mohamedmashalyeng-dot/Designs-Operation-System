/**
 * Provider-agnostic publishing contract (mirrors src/lib/ai/types.ts's
 * pattern) — application code depends only on this, never on a specific
 * platform's SDK/REST shape directly. See src/lib/publishing/index.ts for
 * the channel → provider factory.
 */

export interface PublishParams {
  headline: string;
  supportingCopy: string;
  cta: string;
  /** Raw image bytes — used by providers that accept direct upload (WordPress, LinkedIn). */
  imageBytes: Buffer;
  imageMimeType: string;
  imageFileName: string;
  /** A publicly-fetchable signed URL for the same image — required by providers that only
   * accept a URL rather than a direct upload (Meta's Graph API, for both Facebook and Instagram). */
  imageUrl?: string;
}

export interface PublishResult {
  externalPostId: string;
  externalUrl: string;
}
