"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { selectConcept, rejectConcept, updateConceptAction } from "@/lib/actions/designs";
import { FormatPickerDialog } from "./format-picker";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";

export function ConceptCard({ concept, campaignId }: { concept: Tables<"creative_concepts">; campaignId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = pending || concept.status !== "proposed";

  function handleGenerate(formatId: string) {
    setError(null);
    startTransition(async () => {
      const result = await selectConcept({ campaignId, conceptId: concept.id, formatId });
      if (result?.error) setError(result.error);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectConcept(campaignId, concept.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        concept.status === "rejected" && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{concept.name}</p>
        {concept.status === "selected" && (
          <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3" /> Selected
          </Badge>
        )}
        {concept.status === "rejected" && <Badge variant="secondary">Rejected</Badge>}
      </div>

      <p className="text-xs italic text-muted-foreground">{concept.strategic_idea}</p>

      <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
        <p className="text-sm font-medium">{concept.headline}</p>
        <p className="text-xs text-muted-foreground">{concept.supporting_copy}</p>
        <Badge variant="outline" className="mt-1">
          {concept.cta}
        </Badge>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium">Why this could work</summary>
        <p className="mt-1.5 leading-relaxed">{concept.rationale}</p>
      </details>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button size="sm" onClick={() => setFormatOpen(true)} disabled={disabled} className="flex-1">
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Select
        </Button>
        <Button size="icon-sm" variant="outline" disabled={concept.status !== "proposed"} onClick={() => setEditOpen(true)} aria-label="Edit concept">
          <Pencil />
        </Button>
        <Button size="icon-sm" variant="outline" disabled={disabled} onClick={handleReject} aria-label="Reject concept">
          <X />
        </Button>
      </div>

      <EditConceptDialog concept={concept} campaignId={campaignId} open={editOpen} onOpenChange={setEditOpen} />
      <FormatPickerDialog
        open={formatOpen}
        onOpenChange={setFormatOpen}
        description="Pick the platform size to generate this concept for — the AI Visual Director will produce 4 options in this format."
        pending={pending}
        error={error}
        onConfirm={handleGenerate}
      />
    </div>
  );
}

function EditConceptDialog({
  concept,
  campaignId,
  open,
  onOpenChange,
}: {
  concept: Tables<"creative_concepts">;
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(concept.name);
  const [headline, setHeadline] = useState(concept.headline);
  const [supportingCopy, setSupportingCopy] = useState(concept.supporting_copy);
  const [cta, setCta] = useState(concept.cta);
  const [imagePrompt, setImagePrompt] = useState(concept.image_prompt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateConceptAction({
        conceptId: concept.id,
        campaignId,
        name,
        headline,
        supportingCopy,
        cta,
        imagePrompt,
      });
      if (result?.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit concept</DialogTitle>
          <DialogDescription>Refine this concept before selecting it for visual generation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="concept-name">Name</Label>
            <Input id="concept-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-headline">Headline</Label>
            <Input id="concept-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-copy">Supporting copy</Label>
            <Textarea id="concept-copy" value={supportingCopy} onChange={(e) => setSupportingCopy(e.target.value)} className="min-h-16" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-cta">CTA</Label>
            <Input id="concept-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concept-prompt">Image prompt</Label>
            <Textarea id="concept-prompt" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} className="min-h-24" />
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
