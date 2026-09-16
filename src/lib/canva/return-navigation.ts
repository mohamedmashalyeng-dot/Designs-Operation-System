import "server-only";
import crypto from "node:crypto";

/**
 * Return navigation per canva.dev/docs/connect/return-navigation-guide:
 * append `correlation_state` to a design's edit_url, and Canva appends a
 * signed `correlation_jwt` when redirecting the user back to our
 * registered return URL.
 *
 * TODO (before relying on this for anything security-sensitive): this
 * only base64url-decodes the JWT payload — it does NOT verify the
 * signature against Canva's published JWKS. Add that verification (e.g.
 * with the `jose` package: fetch Canva's JWKS endpoint, `jwtVerify()`)
 * before trusting `designId`/`userId` from a returned JWT for anything
 * beyond a UI hint like "you're probably done editing — want to sync?".
 */

export function buildCorrelationState(designId: string): string {
  // Bound to this design so the return handler knows what to re-sync,
  // without needing separate server-side session storage for the trip.
  return Buffer.from(JSON.stringify({ designId, nonce: crypto.randomUUID() }))
    .toString("base64url")
    .slice(0, 50);
}

export interface DecodedCorrelationJwt {
  correlationState?: string;
  designId?: string;
  userId?: string;
  teamId?: string;
}

export function decodeCorrelationJwt(jwt: string): DecodedCorrelationJwt | null {
  try {
    const [, payloadSegment] = jwt.split(".");
    if (!payloadSegment) return null;
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf-8"));
    return {
      correlationState: payload.correlation_state,
      designId: payload.design_id,
      userId: payload.user_id,
      teamId: payload.team_id,
    };
  } catch {
    return null;
  }
}
