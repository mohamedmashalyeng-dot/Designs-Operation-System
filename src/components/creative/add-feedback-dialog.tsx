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
import { Textarea } from "@/components/ui/textarea";
import { addFeedbackAction } from "@/lib/actions/designs";

export function AddFeedbackDialog({
  designId,
  open,
  onOpenChange,
}: {
  designId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await addFeedbackAction({ designId, comment });
      if (result?.error) setError(result.error);
      else {
        onOpenChange(false);
        setComment("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add feedback</DialogTitle>
          <DialogDescription>Leave a note on this creative without changing its status.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-24" autoFocus />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending || comment.trim().length === 0}>
            {pending && <Loader2 className="animate-spin" />}
            Save feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
