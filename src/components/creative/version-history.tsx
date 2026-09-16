"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Bot, ImageIcon, Loader2, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesignVersionSummary } from "@/lib/creative/queries";
import { formatDateTime } from "@/lib/utils/format";
import { restoreVersionAction } from "@/lib/actions/designs";
import { cn } from "@/lib/utils";

export function VersionHistory({
  designId,
  versions,
  currentVersionId,
}: {
  designId: string;
  versions: DesignVersionSummary[];
  currentVersionId: string | null;
}) {
  if (versions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Version history</h3>
      <ol className="space-y-2">
        {versions.map((version) => (
          <VersionRow
            key={version.id}
            designId={designId}
            version={version}
            isCurrent={version.id === currentVersionId}
          />
        ))}
      </ol>
    </div>
  );
}

function VersionRow({
  designId,
  version,
  isCurrent,
}: {
  designId: string;
  version: DesignVersionSummary;
  isCurrent: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreVersionAction(designId, version.id);
      if (result?.error) toast.error(result.error);
      else toast.success(`Restored version ${version.versionNumber}`);
    });
  }

  return (
    <li className={cn("flex items-start gap-3 rounded-lg border p-3", isCurrent && "border-primary/40 bg-accent/40")}>
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {version.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
          <img src={version.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground/50" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Version {version.versionNumber}</p>
          {isCurrent && <span className="text-xs font-medium text-primary">Current</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{version.changeDescription}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground/70">
          {version.changedByAI ? <Bot className="size-3" /> : <User className="size-3" />}
          {formatDateTime(version.createdAt)}
        </p>
      </div>
      {!isCurrent && (
        <Button size="sm" variant="outline" onClick={handleRestore} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Restore
        </Button>
      )}
    </li>
  );
}
