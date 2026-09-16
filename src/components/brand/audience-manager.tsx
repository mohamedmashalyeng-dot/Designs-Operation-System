"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { upsertAudienceAction, deleteAudienceAction } from "@/lib/actions/brand";
import type { Tables } from "@/types/database";

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function AudienceManager({ brandId, audiences }: { brandId: string; audiences: Tables<"audiences">[] }) {
  const [editing, setEditing] = useState<Tables<"audiences"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      >
        <Plus /> Add audience
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        {audiences.map((audience) => (
          <div key={audience.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{audience.name}</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setEditing(audience);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <DeleteAudienceButton audienceId={audience.id} />
              </div>
            </div>
            {audience.description && <p className="text-xs text-muted-foreground">{audience.description}</p>}
            {audience.motivations.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Motivated by:</span> {audience.motivations.join(", ")}
              </p>
            )}
          </div>
        ))}
        {audiences.length === 0 && <p className="text-sm text-muted-foreground">No audiences yet.</p>}
      </div>

      <AudienceDialog brandId={brandId} audience={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function DeleteAudienceButton({ audienceId }: { audienceId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteAudienceAction(audienceId);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      <Trash2 />
    </Button>
  );
}

function AudienceDialog({
  brandId,
  audience,
  open,
  onOpenChange,
}: {
  brandId: string;
  audience: Tables<"audiences"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(audience?.name ?? "");
  const [description, setDescription] = useState(audience?.description ?? "");
  const [market, setMarket] = useState(audience?.market ?? "");
  const [problems, setProblems] = useState((audience?.problems ?? []).join(", "));
  const [motivations, setMotivations] = useState((audience?.motivations ?? []).join(", "));
  const [preferredMessaging, setPreferredMessaging] = useState(audience?.preferred_messaging ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await upsertAudienceAction({
        brandId,
        audienceId: audience?.id,
        name,
        description: description || undefined,
        market: market || undefined,
        problems: splitList(problems),
        motivations: splitList(motivations),
        preferredMessaging: preferredMessaging || undefined,
      });
      if (result?.error) toast.error(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName("");
          setDescription("");
          setMarket("");
          setProblems("");
          setMotivations("");
          setPreferredMessaging("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{audience ? "Edit audience" : "Add audience"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employers" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
          </div>
          <div className="space-y-1.5">
            <Label>Market</Label>
            <Input value={market} onChange={(e) => setMarket(e.target.value)} placeholder="UK SMEs" />
          </div>
          <div className="space-y-1.5">
            <Label>Problems (comma separated)</Label>
            <Input value={problems} onChange={(e) => setProblems(e.target.value)} placeholder="Hiring cost, skills gap" />
          </div>
          <div className="space-y-1.5">
            <Label>Motivations (comma separated)</Label>
            <Input value={motivations} onChange={(e) => setMotivations(e.target.value)} placeholder="Growth, retention" />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred messaging</Label>
            <Textarea value={preferredMessaging} onChange={(e) => setPreferredMessaging(e.target.value)} className="min-h-16" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
