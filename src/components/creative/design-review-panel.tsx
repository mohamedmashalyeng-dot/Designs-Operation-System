"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ImageIcon,
  Layers,
  Loader2,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { DESIGN_STATUS_META } from "@/lib/constants/labels";
import { LAYOUT_PRESETS } from "@/lib/creative/layouts";
import type { DesignDetail, DesignVersionSummary } from "@/lib/creative/queries";
import {
  adaptFormatAction,
  approveDesignAction,
  editCopyAction,
  regenerateCreativeAction,
  regenerateDesign,
} from "@/lib/actions/designs";
import { AIReviewSummary } from "./ai-review-summary";
import { AIEditDialog } from "./ai-edit-dialog";
import { RejectDialog } from "./feedback-dialog";
import { AddFeedbackDialog } from "./add-feedback-dialog";
import { VersionHistory } from "./version-history";
import { EditInCanvaButton, SyncFromCanvaButton } from "./canva-actions";
import { CreativeRenderer } from "./creative-renderer";
import { FormatPickerDialog } from "./format-picker";
import { PublishDialog } from "./publish-dialog";
import { ChannelPickerDialog } from "./channel-picker-dialog";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types/database";

const REVIEWABLE_STATUSES = new Set(["ai_review", "human_review", "changes_requested"]);

export function DesignReviewPanel({
  detail,
  canvaDesignId,
  connectedChannels,
  hasChannelVersions,
}: {
  detail: DesignDetail;
  canvaDesignId: string | null;
  connectedChannels: Channel[];
  hasChannelVersions: boolean;
}) {
  const { design, campaignId, campaignTitle, conceptName, currentVersion, versions, feedback } = detail;
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [editCopyOpen, setEditCopyOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [approving, startApprove] = useTransition();
  const [regeneratingImage, startRegenerateImage] = useTransition();
  const [regeneratingCreative, startRegenerateCreative] = useTransition();
  const [adapting, startAdapt] = useTransition();

  const statusMeta = DESIGN_STATUS_META[design.status];
  const canDecide = REVIEWABLE_STATUSES.has(design.status);
  const layoutPreset = currentVersion?.layoutPreset ?? "bottom_message";

  function handleApprove() {
    startApprove(async () => {
      const result = await approveDesignAction(design.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Approved");
    });
  }

  function handleRegenerateImage() {
    startRegenerateImage(async () => {
      const result = await regenerateDesign(design.id);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleRegenerateCreative() {
    startRegenerateCreative(async () => {
      const result = await regenerateCreativeAction({ designId: design.id });
      if (result?.error) toast.error(result.error);
    });
  }

  function handleAdaptFormat(formatId: string) {
    setFormatError(null);
    startAdapt(async () => {
      const result = await adaptFormatAction({ sourceDesignId: design.id, formatId });
      if (result?.error) setFormatError(result.error);
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
          {currentVersion?.thumbnailUrl ? (
            <CreativeRenderer
              imageUrl={currentVersion.thumbnailUrl}
              formatId={design.format_id}
              layoutPresetId={layoutPreset}
              headline={currentVersion.headline}
              supportingCopy={currentVersion.supportingCopy}
              cta={currentVersion.cta}
            />
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted text-center">
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
            <Button variant="outline" onClick={() => setEditCopyOpen(true)} disabled={!currentVersion}>
              <Pencil />
              Edit Copy
            </Button>
            {canvaDesignId ? (
              <SyncFromCanvaButton designId={design.id} />
            ) : (
              <EditInCanvaButton designId={design.id} />
            )}
            <Button variant="outline" onClick={handleRegenerateImage} disabled={regeneratingImage || design.status === "generating"}>
              {regeneratingImage ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Regenerate Image
            </Button>
            <Button variant="outline" onClick={handleRegenerateCreative} disabled={regeneratingCreative || design.status === "generating"}>
              {regeneratingCreative ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Regenerate Creative
            </Button>
            {design.status === "approved" && (
              <>
                <Button onClick={() => setPublishOpen(true)}>
                  <Send />
                  Publish
                </Button>
                {hasChannelVersions ? (
                  <Button variant="outline" render={<Link href={`/review/${design.id}/channels`} />} nativeButton={false}>
                    <Layers />
                    View campaign channels
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setChannelOpen(true)}>
                    <Layers />
                    Prepare Campaign
                  </Button>
                )}
                <Button variant="outline" onClick={() => setFormatOpen(true)} disabled={adapting}>
                  {adapting ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                  Create another format
                </Button>
              </>
            )}
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
      {currentVersion && (
        <EditCopyDialog
          designId={design.id}
          currentVersion={currentVersion}
          open={editCopyOpen}
          onOpenChange={setEditCopyOpen}
        />
      )}
      <FormatPickerDialog
        open={formatOpen}
        onOpenChange={setFormatOpen}
        title="Create another format"
        description="Generate this same concept for another platform size — a fresh set of options faithful to the approved creative."
        confirmLabel="Generate"
        defaultFormatId={design.format_id}
        excludeFormatId={design.format_id}
        pending={adapting}
        error={formatError}
        onConfirm={handleAdaptFormat}
      />
      <PublishDialog designId={design.id} connectedChannels={connectedChannels} open={publishOpen} onOpenChange={setPublishOpen} />
      <ChannelPickerDialog masterDesignId={design.id} open={channelOpen} onOpenChange={setChannelOpen} />
    </div>
  );
}

function EditCopyDialog({
  designId,
  currentVersion,
  open,
  onOpenChange,
}: {
  designId: string;
  currentVersion: DesignVersionSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [headline, setHeadline] = useState(currentVersion.headline);
  const [supportingCopy, setSupportingCopy] = useState(currentVersion.supportingCopy);
  const [cta, setCta] = useState(currentVersion.cta);
  const [layoutPreset, setLayoutPreset] = useState(currentVersion.layoutPreset);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await editCopyAction({ designId, headline, supportingCopy, cta, layoutPreset });
      if (result?.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit copy</DialogTitle>
          <DialogDescription>Direct text edits — no AI call, saved as a new version.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-headline">Headline</Label>
            <Input id="edit-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-copy">Supporting copy</Label>
            <Input id="edit-copy" value={supportingCopy} onChange={(e) => setSupportingCopy(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cta">CTA</Label>
            <Input id="edit-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Layout</Label>
            <div className="flex flex-wrap gap-1.5">
              {LAYOUT_PRESETS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLayoutPreset(l.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    layoutPreset === l.id ? "border-primary bg-accent/60 font-medium" : "text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
