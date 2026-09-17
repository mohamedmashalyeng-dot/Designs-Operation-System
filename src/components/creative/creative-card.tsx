import Link from "next/link";
import { ImageIcon, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { DESIGN_STATUS_META } from "@/lib/constants/labels";
import type { DesignSummary } from "@/lib/creative/queries";
import { getFormat } from "@/lib/creative/formats";
import { cn } from "@/lib/utils";

export function CreativeCard({ design, className }: { design: DesignSummary; className?: string }) {
  const meta = DESIGN_STATUS_META[design.status];
  const isGenerating = design.status === "generating" || design.status === "variations_ready";
  const format = getFormat(design.formatId);

  return (
    <Link
      href={`/review/${design.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: `${format.width} / ${format.height}` }}
      >
        {design.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL, not a static asset
          <img
            src={design.thumbnailUrl}
            alt={design.headline ?? design.title}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            {isGenerating ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <ImageIcon className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
            )}
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge label={meta.label} tone={meta.tone} className="bg-background/90 backdrop-blur-sm" />
        </div>
      </div>
      <div className="space-y-0.5 p-3">
        <p className="truncate text-sm font-medium">{design.headline || design.title}</p>
        <p className="truncate text-xs text-muted-foreground">{design.campaignTitle}</p>
      </div>
    </Link>
  );
}
