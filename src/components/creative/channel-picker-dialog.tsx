"use client";

import { useState, useTransition } from "react";
import { Loader2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { prepareCampaignAction } from "@/lib/actions/channel-adaptation";
import { CHANNELS } from "@/lib/constants/enums";
import { CHANNEL_LABELS } from "@/lib/constants/labels";
import type { Channel } from "@/types/database";
import { cn } from "@/lib/utils";

/** "Prepare Campaign" (product spec §2): pick the channels to adapt an
 * approved creative for — each gets its own recropped-or-regenerated
 * visual and platform-specific copy, landing on a grouped review screen. */
export function ChannelPickerDialog({
  masterDesignId,
  excludeChannels = [],
  open,
  onOpenChange,
}: {
  masterDesignId: string;
  /** Channels already prepared for this campaign — hidden so they can't be duplicated. */
  excludeChannels?: Channel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const options = CHANNELS.filter((c) => !excludeChannels.includes(c));
  const [selected, setSelected] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(channel: Channel) {
    setSelected((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await prepareCampaignAction({ masterDesignId, channels: selected });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Prepare campaign</DialogTitle>
          <DialogDescription>
            Pick the channels to adapt this creative for — each gets its own correctly-cropped visual and platform-specific copy.
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 && <p className="text-sm text-muted-foreground">Every channel has already been prepared for this creative.</p>}

        <div className="flex flex-wrap gap-1.5">
          {options.map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => toggle(channel)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected.includes(channel) ? "border-primary bg-accent/60 font-medium" : "text-muted-foreground hover:border-foreground/30"
              )}
            >
              {CHANNEL_LABELS[channel]}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending || selected.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Layers />}
            Generate Channel Versions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
