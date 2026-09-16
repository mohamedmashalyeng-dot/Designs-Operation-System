import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDesignsByStatus } from "@/lib/creative/queries";
import { ReviewGrid } from "@/components/creative/review-grid";

export const metadata: Metadata = { title: "Rejected" };

export default async function RejectedPage() {
  const supabase = await createClient();
  const designs = await getDesignsByStatus(supabase, ["rejected"], 60);

  return (
    <ReviewGrid
      title="Rejected"
      description="Declined creatives — feedback here informs future generations."
      designs={designs}
      emptyIcon={XCircle}
      emptyTitle="Nothing rejected"
      emptyDescription="Rejected creatives will appear here along with the feedback given."
    />
  );
}
