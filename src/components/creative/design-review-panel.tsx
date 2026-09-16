"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ImageIcon, Loader2, MessageSquarePlus, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { DESIGN_STATUS_META } from "@/lib/constants/labels";
import type { DesignDetail } from "@/lib/creative/queries";
import { approveDesignAction, regenerateDesign } from "@/lib/actions/designs";
import { AIReviewSummary } from "./ai-review-summary";
import { AIEditDialog } from "./ai-edit-dialog";
import { RejectDialog } from "./feedback-dialog";
import { AddFeedbackDialog } from "./add-feedback-dialog";
import { VersionHistory } from "./version-history";
import { EditInCanvaButton, SyncFromCanvaButton } from "./canva-actions";
import { formatDateTime } from "@/lib/utils/format";

const REVIEWABLE_STATUSES = new Set(["ai_review", "human_review", "changes_requested"]);

export function DesignReviewPanel({
  detail,
  canvaDesignId,
}: {
  detail: DesignDetail;
  canvaDesignId: string | null;
}) {
  const { design, campaignId, campaignTitle, conceptName, currentVersion, versions, feedback } = detail;
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [approving, startApprove] = useTransition();
  const [regenerating, startRegenerate] = useTransition();

  const statusMeta = DESIGN_STATUS_META[design.status];
  const canDecide = REVIEWABLE_STATUSES.has(design.status);

  function handleApprove() {
    startApprove(async () => {
      const result = await approveDesignAction(design.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Approved");
    });
  }

  function handleRegenerate() {
    startRegenerate(async () => {
      const result = await regenerateDesign(design.id);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href={`/campaigns/${campaignId}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          {campaignTitle}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{design.title}</h1>
          <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
        </div>
        <p className="text-xs text-muted-foreground">From concept: {conceptName}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
            {currentVersion?.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
              <img src={currentVersion.thumbnailUrl} alt={currentVersion.headline} className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-center">
                {design.status === "generating" ? (
                  <>
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Generating…</p>
                  </>
                ) : (
                  <>
                    <XCircle className="size-6 text-destructive" />
                    <p className="max-w-xs text-xs text-destructive">
                      {currentVersion?.assetErrorMessage || "Generation didn't complete — try regenerating."}
                    </p>
                  </>
                )}
              </div>
            )}
            {currentVersion?.thumbnailUrl && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-6 pt-20">
                <p className="text-xl font-semibold text-white drop-shadow-sm">{currentVersion.headline}</p>
                <p className="mt-1.5 text-sm text-white/85">{currentVersion.supportingCopy}</p>
                <span className="mt-3 inline-block rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black">
                  {currentVersion.cta}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canDecide && (
              <Button onClick={handleApprove} disabled={approving || !currentVersion?.thumbnailUrl}>
                {approving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => setAiEditOpen(true)}>
              <Sparkles />
              Edit with AI
            </Button>
            {canvaDesignId ? (
              <SyncFromCanvaButton designId={design.id} />
            ) : (
              <EditInCanvaButton designId={design.id} />
            )}
            <Button variant="outline" onClick={handleRegenerate} disabled={regenerating || design.status === "generating"}>
              {regenerating ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Regenerate
            </Button>
            <Button variant="outline" onClick={() => setFeedbackOpen(true)}>
              <MessageSquarePlus />
              Add Feedback
            </Button>
            {canDecide && (
              <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                <XCircle />
                Reject
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <AIReviewSummary review={currentVersion?.aiReview ?? null} />

          {feedback.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold">Feedback</h3>
              <ul className="space-y-2">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{f.type.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{formatDateTime(f.created_at)}</span>
                    </div>
                    {f.reasons.length > 0 && (
                      <p className="mt-1 text-muted-foreground">{f.reasons.join(", ").replace(/_/g, " ")}</p>
                    )}
                    {f.comment && <p className="mt-1 text-muted-foreground">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <VersionHistory designId={design.id} versions={versions} currentVersionId={design.current_version_id} />

          {versions.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <ImageIcon className="size-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No versions yet</p>
            </div>
          )}
        </div>
      </div>

      <AIEditDialog designId={design.id} open={aiEditOpen} onOpenChange={setAiEditOpen} />
      <RejectDialog designId={design.id} open={rejectOpen} onOpenChange={setRejectOpen} />
      <AddFeedbackDialog designId={design.id} open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
