"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publishNowAction, scheduleAction } from "@/lib/actions/connections";
import { CHANNEL_LABELS } from "@/lib/constants/labels";
import type { Channel } from "@/types/database";
import { cn } from "@/lib/utils";

export function PublishDialog({
  designId,
  connectedChannels,
  open,
  onOpenChange,
}: {
  designId: string;
  connectedChannels: Channel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [channel, setChannel] = useState<Channel | null>(connectedChannels[0] ?? null);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!channel) return;
    setError(null);
    startTransition(async () => {
      if (mode === "now") {
        const result = await publishNowAction({ designId, channel });
        if (result?.error) setError(result.error);
        else {
          toast.success("Published");
          setPublishedUrl(result.externalUrl ?? null);
        }
      } else {
        if (!scheduledFor) {
          setError("Pick a date and time.");
          return;
        }
        const result = await scheduleAction({ designId, channel, scheduledFor: new Date(scheduledFor).toISOString() });
        if (result?.error) setError(result.error);
        else {
          toast.success("Scheduled");
          onOpenChange(false);
        }
      }
    });
  }

  if (connectedChannels.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>No channels connected</DialogTitle>
            <DialogDescription>Connect LinkedIn, Meta, or a Website under Connections before publishing.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Publish this creative</DialogTitle>
          <DialogDescription>Choose a connected channel and publish now, or schedule it for later.</DialogDescription>
        </DialogHeader>

        {publishedUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Published successfully.</p>
            <a href={publishedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-primary underline">
              View the live post <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <div className="flex flex-wrap gap-1.5">
                {connectedChannels.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      channel === c ? "border-primary bg-accent/60 font-medium" : "text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {CHANNEL_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>When</Label>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant={mode === "now" ? "default" : "outline"} onClick={() => setMode("now")}>
                  Publish now
                </Button>
                <Button type="button" size="sm" variant={mode === "later" ? "default" : "outline"} onClick={() => setMode("later")}>
                  Schedule
                </Button>
              </div>
            </div>

            {mode === "later" && (
              <div className="space-y-1.5">
                <Label htmlFor="scheduled-for">Date &amp; time</Label>
                <Input id="scheduled-for" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {publishedUrl ? "Close" : "Cancel"}
          </Button>
          {!publishedUrl && (
            <Button onClick={handleSubmit} disabled={pending || !channel}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              {mode === "now" ? "Publish" : "Schedule"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
