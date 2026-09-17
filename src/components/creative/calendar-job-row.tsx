"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ImageIcon, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { retryJobAction, cancelJobAction, rescheduleJobAction } from "@/lib/actions/connections";
import { CHANNEL_LABELS, PUBLICATION_STATUS_META } from "@/lib/constants/labels";
import { formatDateTime } from "@/lib/utils/format";
import type { PublicationJobSummary } from "@/lib/publishing/queries";

export function CalendarJobRow({ job }: { job: PublicationJobSummary }) {
  const meta = PUBLICATION_STATUS_META[job.status];
  const [rescheduling, setRescheduling] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      const result = await retryJobAction({ jobId: job.id });
      if (result?.error) toast.error(result.error);
      else toast.success("Published");
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelJobAction({ jobId: job.id });
      if (result?.error) toast.error(result.error);
      else toast.success("Cancelled");
    });
  }

  function handleReschedule() {
    if (!newTime) return;
    startTransition(async () => {
      const result = await rescheduleJobAction({ jobId: job.id, scheduledFor: new Date(newTime).toISOString() });
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Rescheduled");
        setRescheduling(false);
      }
    });
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Link href={`/review/${job.designId}`} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {job.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
              <img src={job.thumbnailUrl} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-4 text-muted-foreground/50" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-medium">{job.designTitle}</p>
            <p className="text-xs text-muted-foreground">
              {CHANNEL_LABELS[job.channel]}
              {job.scheduledFor ? ` · ${formatDateTime(job.scheduledFor)}` : ""}
            </p>
            {job.errorMessage && <p className="truncate text-xs text-destructive">{job.errorMessage}</p>}
          </div>
        </Link>
        <StatusBadge label={meta.label} tone={meta.tone} />
      </div>

      {(job.status === "failed" || job.status === "scheduled") && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
          {job.status === "failed" && (
            <Button size="sm" variant="outline" onClick={handleRetry} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Retry
            </Button>
          )}
          {(job.status === "scheduled" || job.status === "failed") &&
            (rescheduling ? (
              <>
                <Input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-8 w-auto" />
                <Button size="sm" onClick={handleReschedule} disabled={pending || !newTime}>
                  {pending && <Loader2 className="animate-spin" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRescheduling(false)} disabled={pending}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setRescheduling(true)} disabled={pending}>
                Reschedule
              </Button>
            ))}
          {job.status === "scheduled" && (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <X />}
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
