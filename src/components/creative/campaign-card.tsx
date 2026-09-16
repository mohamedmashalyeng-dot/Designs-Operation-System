import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_STATUS_META } from "@/lib/constants/labels";
import type { Tables } from "@/types/database";
import { formatRelativeTime } from "@/lib/utils/format";

export function CampaignCard({ campaign }: { campaign: Tables<"campaigns"> }) {
  const meta = CAMPAIGN_STATUS_META[campaign.status];

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-start justify-between gap-2">
        <StatusBadge label={meta.label} tone={meta.tone} />
        <ArrowUpRight className="size-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-medium">{campaign.title}</p>
        <p className="text-xs text-muted-foreground">
          {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} · {formatRelativeTime(campaign.updated_at)}
        </p>
      </div>
    </Link>
  );
}
