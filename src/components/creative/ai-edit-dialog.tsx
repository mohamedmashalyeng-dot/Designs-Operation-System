"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import { aiEditDesign } from "@/lib/actions/designs";

const SUGGESTIONS = [
  "Make this less corporate",
  "Use a more authentic UK workplace",
  "Move away from stock-photo styling",
  "Give me a stronger headline",
  "Keep everything but replace the image",
];

export function AIEditDialog({
  designId,
  open,
  onOpenChange,
}: {
  designId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await aiEditDesign({ designId, feedback });
      if (result?.error) setError(result.error);
      else {
        onOpenChange(false);
        setFeedback("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit with AI</DialogTitle>
          <DialogDescription>
            Describe the change in plain language. This creates a new version — nothing is overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Make this less corporate…"
            className="min-h-24"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFeedback(s)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending || feedback.trim().length < 3}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Applying…" : "Apply change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
