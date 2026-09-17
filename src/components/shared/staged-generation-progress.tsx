"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const DEFAULT_STAGES = [
  "Understanding your creative direction",
  "Preparing the visual production brief",
  "Creating image prompts",
  "Generating visual options",
  "Applying Kent Business College identity",
  "Preparing creatives for review",
];

/** Stage-based (not fake-percentage, per product spec §15) generation
 * feedback for a synchronous, single-request generation — cycles through
 * labels on a timer while the request is in flight rather than claiming
 * real progress events that don't exist yet. */
export function StagedGenerationProgress({
  stages = DEFAULT_STAGES,
  intervalMs = 2200,
  className,
}: {
  stages?: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => Math.min(i + 1, stages.length - 1)), intervalMs);
    return () => clearInterval(id);
  }, [stages.length, intervalMs]);

  return (
    <div className={className ?? "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center"}>
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{stages[index]}</p>
    </div>
  );
}
