import { NextResponse, type NextRequest } from "next/server";
import { processDueJobs } from "@/lib/publishing/service";

/**
 * Fires every `publication_jobs` row whose `scheduled_for` has arrived.
 * Nothing in this app calls this on a timer by itself — wire a real
 * scheduler at it once deployed (e.g. Vercel Cron hitting this route every
 * few minutes, or a Supabase scheduled Edge Function). Protected by
 * CRON_SECRET so it can't be triggered by anyone who finds the URL.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured — refusing to run." }, { status: 503 });
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueJobs();
  return NextResponse.json(result);
}
