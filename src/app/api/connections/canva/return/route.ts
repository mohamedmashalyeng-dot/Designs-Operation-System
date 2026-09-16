import { NextResponse, type NextRequest } from "next/server";
import { decodeCorrelationJwt } from "@/lib/canva/return-navigation";

/**
 * Landing point for Canva's "Return" button (return-navigation-guide).
 * The JWT here is decoded but not signature-verified — see the TODO in
 * `src/lib/canva/return-navigation.ts` — so this only uses it to route
 * the user back to the right design, never as an authorization decision.
 */
export async function GET(request: NextRequest) {
  const jwt = request.nextUrl.searchParams.get("correlation_jwt");
  const decoded = jwt ? decodeCorrelationJwt(jwt) : null;

  let designId: string | null = null;
  if (decoded?.correlationState) {
    try {
      const parsed = JSON.parse(Buffer.from(decoded.correlationState, "base64url").toString("utf-8")) as {
        designId?: string;
      };
      designId = parsed.designId ?? null;
    } catch {
      designId = null;
    }
  }

  const target = designId
    ? new URL(`/review/${designId}?canva_return=1`, request.url)
    : new URL("/connections/canva", request.url);
  return NextResponse.redirect(target);
}
