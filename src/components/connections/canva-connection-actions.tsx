"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectCanvaAction } from "@/lib/actions/canva";

export function ConnectCanvaButton({ configured }: { configured: boolean }) {
  if (!configured) {
    return (
      <Button disabled className="w-full">
        Connect Canva
      </Button>
    );
  }
  return (
    <Button render={<a href="/api/connections/canva/authorize" />} nativeButton={false} className="w-full">
      Connect Canva
    </Button>
  );
}

export function DisconnectCanvaButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await disconnectCanvaAction();
      if (result?.error) toast.error(result.error);
      else toast.success("Canva disconnected");
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : <Unplug />}
      Disconnect
    </Button>
  );
}
