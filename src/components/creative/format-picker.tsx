"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SOCIAL_FORMATS, type SocialFormat } from "@/lib/creative/formats";
import { cn } from "@/lib/utils";

/** Format selection with a visual ratio preview per option (product spec
 * §8: "the UI should show visual ratio previews so the user can
 * immediately understand each format"). Reused for both the initial
 * concept → format → generate step and "Create another format". */
export function FormatPickerDialog({
  open,
  onOpenChange,
  title = "Choose a format",
  description = "Pick the platform size to generate this creative for.",
  confirmLabel = "Generate Creative",
  defaultFormatId = "linkedin_landscape",
  excludeFormatId,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  defaultFormatId?: string;
  /** Hides one format — used by "Create another format" so you can't re-pick the source's own format. */
  excludeFormatId?: string;
  pending: boolean;
  error?: string | null;
  onConfirm: (formatId: string) => void;
}) {
  const options = SOCIAL_FORMATS.filter((f) => f.id !== excludeFormatId);
  const [formatId, setFormatId] = useState(options.some((f) => f.id === defaultFormatId) ? defaultFormatId : options[0].id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {options.map((format) => (
            <FormatOption key={format.id} format={format} selected={formatId === format.id} onSelect={() => setFormatId(format.id)} />
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(formatId)} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormatOption({ format, selected, onSelect }: { format: SocialFormat; selected: boolean; onSelect: () => void }) {
  const ratio = format.width / format.height;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors",
        selected ? "border-primary bg-accent/50" : "hover:border-foreground/30"
      )}
    >
      <div className="flex h-12 w-full items-center justify-center">
        <div
          className={cn("rounded-sm border-2", selected ? "border-primary bg-primary/10" : "border-muted-foreground/40 bg-muted")}
          style={{
            aspectRatio: `${format.width} / ${format.height}`,
            height: ratio >= 1 ? "100%" : "auto",
            width: ratio >= 1 ? "auto" : "100%",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        />
      </div>
      <div>
        <p className="text-xs font-medium">{format.platform}</p>
        <p className="text-[11px] text-muted-foreground">
          {format.label} · {format.aspectRatio}
        </p>
      </div>
    </button>
  );
}
