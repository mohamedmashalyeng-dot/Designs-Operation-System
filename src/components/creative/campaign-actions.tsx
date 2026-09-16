"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryBriefGeneration, generateConceptsAction } from "@/lib/actions/campaigns";

export function RetryBriefButton({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await retryBriefGeneration(campaignId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Retry
    </Button>
  );
}

export function GenerateConceptsButton({ campaignId, label = "Generate Concepts" }: { campaignId: string; label?: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateConceptsAction(campaignId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {pending ? "Generating…" : label}
    </Button>
  );
}
