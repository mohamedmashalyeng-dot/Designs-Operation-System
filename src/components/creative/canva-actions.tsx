"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Palette, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openInCanvaAction, syncFromCanvaAction } from "@/lib/actions/canva";

export function EditInCanvaButton({ designId }: { designId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await openInCanvaAction(designId);
      if (result?.error) toast.error(result.error);
      else if (result?.url) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Palette />}
      Edit in Canva
    </Button>
  );
}

export function SyncFromCanvaButton({ designId }: { designId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncFromCanvaAction(designId);
      if (result?.error) toast.error(result.error);
      else toast.success("Synced the latest edit from Canva");
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Sync from Canva
    </Button>
  );
}
