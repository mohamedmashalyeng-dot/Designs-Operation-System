import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDesignsByStatus } from "@/lib/creative/queries";
import { ReviewGrid } from "@/components/creative/review-grid";

export const metadata: Metadata = { title: "Awaiting Review" };

export default async function ReviewQueuePage() {
  const supabase = await createClient();
  const designs = await getDesignsByStatus(supabase, ["ai_review", "human_review", "changes_requested"], 60);

  return (
    <ReviewGrid
      title="Awaiting Review"
      description="Creatives ready for a decision, newest first."
      designs={designs}
      emptyIcon={ClipboardCheck}
      emptyTitle="Nothing needs review right now"
      emptyDescription="Generated creatives will show up here as soon as they're ready for a decision."
    />
  );
}
