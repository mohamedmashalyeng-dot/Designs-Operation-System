"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectMetaAction } from "@/lib/actions/connections";

export function ConnectMetaButton({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <Button disabled className="w-full">
        Connect Meta
      </Button>
    );
  }
  return (
    <Button render={<a href="/api/connections/meta/authorize" />} nativeButton={false} className="w-full">
      Connect Meta
    </Button>
  );
}

export function DisconnectMetaButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await disconnectMetaAction();
      if (result?.error) toast.error(result.error);
      else toast.success("Meta disconnected");
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : <Unplug />}
      Disconnect
    </Button>
  );
}
