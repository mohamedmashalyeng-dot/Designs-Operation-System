import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, AlertTriangle, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getChannelVersions } from "@/lib/creative/queries";
import { getConnectedChannels } from "@/lib/connections/queries";
import { ChannelVersionCard } from "@/components/creative/channel-version-card";
import { PrepareMoreChannelsButton } from "@/components/creative/prepare-more-channels-button";
import { EmptyState } from "@/components/shared/empty-state";
import { CHANNEL_LABELS } from "@/lib/constants/labels";
import { getFormat } from "@/lib/creative/formats";
import type { Channel } from "@/types/database";

export const metadata: Metadata = { title: "Campaign Channels" };

export default async function ChannelsReviewPage({ params, searchParams }: PageProps<"/review/[id]/channels">) {
  const { id } = await params;
  const search = await searchParams;
  const supabase = await createClient();

  const { data: master } = await supabase.from("designs").select("*").eq("id", id).single();
  if (!master) notFound();

  const { data: campaign } = await supabase.from("campaigns").select("id, title").eq("id", master.campaign_id).single();

  const [channelVersions, connectedChannels] = await Promise.all([getChannelVersions(supabase, id), getConnectedChannels(supabase)]);

  const preparedChannels = channelVersions.map((v) => getFormat(v.formatId).channel);
  const failedChannels = typeof search.failed === "string" ? (search.failed.split(",") as Channel[]) : [];
  const approvedCount = channelVersions.filter((v) => v.status === "approved").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/review/${id}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          {master.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Campaign channels</h1>
            <p className="text-xs text-muted-foreground">
              {campaign?.title} · {approvedCount} of {channelVersions.length} approved
            </p>
          </div>
          <PrepareMoreChannelsButton masterDesignId={id} excludeChannels={preparedChannels} />
        </div>
      </div>

      {failedChannels.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Couldn&apos;t prepare {failedChannels.map((c) => CHANNEL_LABELS[c] ?? c).join(", ")} — try{" "}
            <PrepareMoreChannelsButton masterDesignId={id} excludeChannels={preparedChannels} inline label="preparing it again" /> from here.
          </span>
        </div>
      )}

      {channelVersions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channelVersions.map((version) => (
            <ChannelVersionCard key={version.id} design={version} connectedChannels={connectedChannels} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title="No channel versions yet"
          description="Prepare this campaign for Instagram, Facebook, LinkedIn, or your website — each gets its own correctly-cropped visual and platform copy."
          action={<PrepareMoreChannelsButton masterDesignId={id} excludeChannels={[]} />}
          className="py-16"
        />
      )}
    </div>
  );
}
