"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectLinkedInAction } from "@/lib/actions/connections";

export function ConnectLinkedInButton({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <Button disabled className="w-full">
        Connect LinkedIn
      </Button>
    );
  }
  return (
    <Button render={<a href="/api/connections/linkedin/authorize" />} nativeButton={false} className="w-full">
      Connect LinkedIn
    </Button>
  );
}

export function DisconnectLinkedInButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await disconnectLinkedInAction();
      if (result?.error) toast.error(result.error);
      else toast.success("LinkedIn disconnected");
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : <Unplug />}
      Disconnect
    </Button>
  );
}
