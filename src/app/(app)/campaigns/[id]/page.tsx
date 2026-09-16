import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLatestBrief } from "@/lib/creative/briefs";
import { getDesignsForCampaign } from "@/lib/creative/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { GenerationProgress } from "@/components/shared/generation-progress";
import { EmptyState } from "@/components/shared/empty-state";
import { BriefSummary } from "@/components/creative/brief-summary";
import { ConceptCard } from "@/components/creative/concept-card";
import { CreativeCard } from "@/components/creative/creative-card";
import { RetryBriefButton, GenerateConceptsButton } from "@/components/creative/campaign-actions";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  AUDIENCE_TYPE_LABELS,
  CHANNEL_LABELS,
  CAMPAIGN_STATUS_META,
} from "@/lib/constants/labels";
import { Sparkles, FileText, LayoutGrid } from "lucide-react";

export default async function CampaignDetailPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();

  const [brief, concepts, designs] = await Promise.all([
    getLatestBrief(supabase, id),
    supabase
      .from("creative_concepts")
      .select("*")
      .eq("campaign_id", id)
      .order("display_order", { ascending: true })
      .then((r) => r.data ?? []),
    getDesignsForCampaign(supabase, id),
  ]);

  const statusMeta = CAMPAIGN_STATUS_META[campaign.status];

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link href="/library" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Creative Library
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{campaign.raw_prompt}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
            {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]}
          </span>
          <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
            {AUDIENCE_TYPE_LABELS[campaign.audience_type]}
          </span>
          {campaign.channels.map((c) => (
            <span key={c} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              {CHANNEL_LABELS[c]}
            </span>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Creative brief
        </h2>
        {campaign.status === "brief_generating" ? (
          <GenerationProgress label="Briefing the Creative Director…" />
        ) : brief ? (
          <BriefSummary brief={brief} />
        ) : (
          <EmptyState
            icon={FileText}
            title="Brief generation didn't complete"
            description="Something went wrong turning this idea into a creative brief."
            action={<RetryBriefButton campaignId={campaign.id} />}
          />
        )}
      </section>

      {brief && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Creative concepts
            </h2>
            {concepts.length > 0 && campaign.status !== "concepts_generating" && (
              <GenerateConceptsButton campaignId={campaign.id} label="Regenerate" />
            )}
          </div>

          {campaign.status === "concepts_generating" ? (
            <GenerationProgress label="Developing creative concepts…" />
          ) : concepts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {concepts.map((concept) => (
                <ConceptCard key={concept.id} concept={concept} campaignId={campaign.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Ready to see creative directions?"
              description="Generate around four meaningfully different concepts from this brief."
              action={<GenerateConceptsButton campaignId={campaign.id} />}
            />
          )}
        </section>
      )}

      {designs.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <LayoutGrid className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Designs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map((design) => (
              <CreativeCard key={design.id} design={design} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
