"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganisationAction, updateProfileAction } from "@/lib/actions/settings";

export function ProfileForm({ email, fullName }: { email: string; fullName: string | null }) {
  const [name, setName] = useState(fullName ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <p className="text-sm font-medium">Profile</p>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="full-name">Full name</Label>
        <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={pending || !name.trim()}
        onClick={() =>
          startTransition(async () => {
            const result = await updateProfileAction({ fullName: name });
            if (result?.error) toast.error(result.error);
            else toast.success("Profile updated");
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />}
        Save
      </Button>
    </div>
  );
}

export function OrganisationForm({ organisationId, name: initialName, role }: { organisationId: string; name: string; role: string }) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="space-y-4 rounded-lg border p-5">
      <p className="text-sm font-medium">Workspace</p>
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Workspace name</Label>
        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="space-y-1.5">
        <Label>Your role</Label>
        <p className="text-sm capitalize text-muted-foreground">{role}</p>
      </div>
      {canEdit && (
        <Button
          size="sm"
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await updateOrganisationAction({ organisationId, name });
              if (result?.error) toast.error(result.error);
              else toast.success("Workspace updated");
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      )}
    </div>
  );
}
