"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreativeRenderer } from "./creative-renderer";
import { StagedGenerationProgress } from "@/components/shared/staged-generation-progress";
import { LAYOUT_PRESETS } from "@/lib/creative/layouts";
import { chooseVariationAction, regenerateCreativeAction } from "@/lib/actions/designs";
import type { PendingVariationsBatch } from "@/lib/creative/queries";
import { cn } from "@/lib/utils";

/** The "choose your favourite" screen (product spec §9/§16) — the AI
 * Visual Director's 4 variations, each rendered through the same
 * CreativeRenderer used everywhere else so what you pick is exactly what
 * you'll get. Headline/copy/CTA/layout are editable here before picking,
 * same principle as everywhere else: text edits never need another AI call. */
export function VariationPicker({ designId, batch }: { designId: string; batch: PendingVariationsBatch }) {
  const [headline, setHeadline] = useState(batch.headline);
  const [supportingCopy, setSupportingCopy] = useState(batch.supportingCopy);
  const [cta, setCta] = useState(batch.cta);
  const [layoutPreset, setLayoutPreset] = useState(batch.layoutPreset);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, startChoosing] = useTransition();
  const [regenerating, startRegenerate] = useTransition();

  const succeeded = batch.variations.filter((v) => v.status === "completed");
  const failedCount = batch.variations.length - succeeded.length;

  function handleChoose(assetId: string) {
    setError(null);
    setChoosingId(assetId);
    startChoosing(async () => {
      const result = await chooseVariationAction({ designId, assetId, headline, supportingCopy, cta, layoutPreset });
      if (result?.error) {
        setError(result.error);
        setChoosingId(null);
      }
    });
  }

  function handleRegenerate() {
    setError(null);
    startRegenerate(async () => {
      const result = await regenerateCreativeAction({ designId });
      if (result?.error) toast.error(result.error);
    });
  }

  if (regenerating) {
    return <StagedGenerationProgress />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="var-headline">Headline</Label>
          <Input id="var-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="var-copy">Supporting copy</Label>
          <Input id="var-copy" value={supportingCopy} onChange={(e) => setSupportingCopy(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="var-cta">CTA</Label>
          <Input id="var-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
        </div>
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

      {failedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {succeeded.length} of {batch.variations.length} visual options generated.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {batch.variations.map((v) => (
          <div key={v.assetId} className="space-y-2">
            {v.status === "completed" && v.thumbnailUrl ? (
              <CreativeRenderer
                imageUrl={v.thumbnailUrl}
                formatId={batch.formatId}
                layoutPresetId={layoutPreset}
                headline={headline}
                supportingCopy={supportingCopy}
                cta={cta}
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed bg-muted/40 p-4 text-center">
                <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                  <XCircle className="size-4 text-destructive" />
                  {v.errorMessage || "This option failed to generate."}
                </div>
              </div>
            )}
            <Button size="sm" className="w-full" disabled={v.status !== "completed" || choosing} onClick={() => handleChoose(v.assetId)}>
              {choosingId === v.assetId && choosing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Choose this one
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={choosing}>
        <RotateCcw />
        Generate different options
      </Button>
    </div>
  );
}
