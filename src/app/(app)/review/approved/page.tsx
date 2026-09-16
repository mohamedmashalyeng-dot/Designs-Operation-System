import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDesignsByStatus } from "@/lib/creative/queries";
import { ReviewGrid } from "@/components/creative/review-grid";

export const metadata: Metadata = { title: "Approved" };

export default async function ApprovedPage() {
  const supabase = await createClient();
  const designs = await getDesignsByStatus(supabase, ["approved", "scheduled", "published"], 60);

  return (
    <ReviewGrid
      title="Approved"
      description="Creatives ready to resize, schedule, and publish."
      designs={designs}
      emptyIcon={CheckCircle2}
      emptyTitle="Nothing approved yet"
      emptyDescription="Approved creatives will appear here."
    />
  );
}
