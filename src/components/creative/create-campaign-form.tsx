"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromptComposer } from "./prompt-composer";
import { createCampaign } from "@/lib/actions/campaigns";
import { AUDIENCE_TYPES, CAMPAIGN_OBJECTIVES, CHANNELS, type AudienceType, type CampaignObjective, type Channel } from "@/lib/constants/enums";
import { AUDIENCE_TYPE_LABELS, CAMPAIGN_OBJECTIVE_LABELS, CHANNEL_LABELS } from "@/lib/constants/labels";
import { cn } from "@/lib/utils";

export function CreateCampaignForm() {
  const [rawPrompt, setRawPrompt] = useState("");
  const [objective, setObjective] = useState<CampaignObjective>("leads");
  const [audienceType, setAudienceType] = useState<AudienceType>("employers");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleChannel(channel: Channel) {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCampaign({ rawPrompt, objective, audienceType, channels });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl text-kbc-purple dark:text-kbc-purple-bright">What do you want to create?</h1>
        <p className="text-sm text-muted-foreground">
          Describe the campaign in plain language — the AI Creative Director will turn it into a brief, concepts, and visuals.
        </p>
      </div>

      <PromptComposer value={rawPrompt} onChange={setRawPrompt} disabled={pending} />

      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          Add details (optional)
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showDetails && "rotate-180")} />
        </button>

        {showDetails && (
          <div className="grid gap-5 border-t p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Campaign goal</label>
              <Select value={objective} onValueChange={(v) => setObjective(v as CampaignObjective)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_OBJECTIVES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {CAMPAIGN_OBJECTIVE_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Audience</label>
              <Select value={audienceType} onValueChange={(v) => setAudienceType(v as AudienceType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_TYPE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Channels</label>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <Button
                    key={channel}
                    type="button"
                    size="sm"
                    variant={channels.includes(channel) ? "default" : "outline"}
                    onClick={() => toggleChannel(channel)}
                  >
                    {CHANNEL_LABELS[channel]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={pending || rawPrompt.trim().length < 10}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {pending ? "Briefing the Creative Director…" : "Create Campaign"}
      </Button>
    </form>
  );
}
