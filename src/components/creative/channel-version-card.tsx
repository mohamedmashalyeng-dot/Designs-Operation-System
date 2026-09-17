"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreativeRenderer } from "./creative-renderer";
import { PublishDialog } from "./publish-dialog";
import { approveDesignAction } from "@/lib/actions/designs";
import { DESIGN_STATUS_META, CHANNEL_LABELS } from "@/lib/constants/labels";
import type { DesignSummary } from "@/lib/creative/queries";
import { getFormat } from "@/lib/creative/formats";
import type { Channel } from "@/types/database";

const REVIEWABLE_STATUSES = new Set(["ai_review", "human_review", "changes_requested"]);

export function ChannelVersionCard({ design, connectedChannels }: { design: DesignSummary; connectedChannels: Channel[] }) {
  const format = getFormat(design.formatId);
  const channel = format.channel;
  const meta = DESIGN_STATUS_META[design.status];
  const [publishOpen, setPublishOpen] = useState(false);
  const [approving, startApprove] = useTransition();

  const canApprove = REVIEWABLE_STATUSES.has(design.status);
  const canPublish = design.status === "approved" && connectedChannels.includes(channel);

  function handleApprove() {
    startApprove(async () => {
      const result = await approveDesignAction(design.id);
      if (result?.error) toast.error(result.error);
      else toast.success(`${CHANNEL_LABELS[channel]} approved`);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{CHANNEL_LABELS[channel]}</p>
        <StatusBadge label={meta.label} tone={meta.tone} />
      </div>

      <CreativeRenderer
        imageUrl={design.thumbnailUrl}
        formatId={design.formatId}
        layoutPresetId="bottom_message"
        headline={design.headline ?? design.title}
        supportingCopy=""
        cta=""
        variant="compact"
      />

      <p className="line-clamp-2 text-sm font-medium">{design.headline ?? design.title}</p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<Link href={`/review/${design.id}`} />} nativeButton={false}>
          Review &amp; edit
        </Button>
        {canApprove && (
          <Button size="sm" onClick={handleApprove} disabled={approving}>
            {approving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Approve
          </Button>
        )}
        {design.status === "approved" && (
          <Button size="sm" variant="outline" disabled={!canPublish} onClick={() => setPublishOpen(true)}>
            <Send />
            {canPublish ? "Publish" : `${CHANNEL_LABELS[channel]} not connected`}
          </Button>
        )}
        {design.status === "rejected" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="size-3.5" /> Rejected
          </span>
        )}
      </div>

      <PublishDialog
        designId={design.id}
        connectedChannels={connectedChannels.includes(channel) ? [channel] : []}
        open={publishOpen}
        onOpenChange={setPublishOpen}
      />
    </div>
  );
}
