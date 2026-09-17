import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDesignDetail, getPendingVariations } from "@/lib/creative/queries";
import { getConnectedChannels } from "@/lib/connections/queries";
import { DesignReviewPanel } from "@/components/creative/design-review-panel";
import { VariationPicker } from "@/components/creative/variation-picker";
import { StagedGenerationProgress } from "@/components/shared/staged-generation-progress";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Review Creative" };

export default async function DesignReviewPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: design } = await supabase.from("designs").select("*").eq("id", id).single();
  if (!design) notFound();

  if (design.status === "variations_ready" || design.status === "generating") {
    const [batch, { data: campaign }] = await Promise.all([
      getPendingVariations(supabase, id),
      supabase.from("campaigns").select("id, title").eq("id", design.campaign_id).single(),
    ]);

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Link
            href={`/campaigns/${design.campaign_id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {campaign?.title ?? "Campaign"}
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{design.title}</h1>
          <p className="text-xs text-muted-foreground">Choose the visual direction to carry forward.</p>
        </div>

        {batch ? (
          <VariationPicker designId={id} batch={batch} />
        ) : design.status === "generating" ? (
          <StagedGenerationProgress />
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="No visual options to review"
            description="Generation may still be finishing — refresh in a moment, or try again from the campaign page."
          />
        )}
      </div>
    );
  }

  const [detail, connectedChannels, { count: channelVersionCount }] = await Promise.all([
    getDesignDetail(supabase, id),
    getConnectedChannels(supabase),
    supabase.from("designs").select("id", { count: "exact", head: true }).eq("master_design_id", id),
  ]);
  if (!detail) notFound();

  return (
    <DesignReviewPanel
      detail={detail}
      canvaDesignId={design.canva_design_id}
      connectedChannels={connectedChannels}
      hasChannelVersions={Boolean(channelVersionCount)}
    />
  );
}
