"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { REJECTION_REASONS, type RejectionReason } from "@/lib/constants/enums";
import { REJECTION_REASON_LABELS } from "@/lib/constants/labels";
import { rejectDesignAction } from "@/lib/actions/designs";

export function RejectDialog({
  designId,
  open,
  onOpenChange,
}: {
  designId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleReason(reason: RejectionReason) {
    setReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await rejectDesignAction({ designId, reasons, comment: comment || undefined });
      if (result?.error) setError(result.error);
      else {
        onOpenChange(false);
        setReasons([]);
        setComment("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this creative</DialogTitle>
          <DialogDescription>
            Tell us why — this feedback helps future generations avoid the same issue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {REJECTION_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-2 text-sm">
                <Checkbox checked={reasons.includes(reason)} onCheckedChange={() => toggleReason(reason)} />
                {REJECTION_REASON_LABELS[reason]}
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reject-comment">Additional feedback (optional)</Label>
            <Textarea
              id="reject-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What specifically would you change?"
              className="min-h-20"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={pending || reasons.length === 0}>
            {pending && <Loader2 className="animate-spin" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
