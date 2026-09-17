"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelPickerDialog } from "./channel-picker-dialog";
import type { Channel } from "@/types/database";

export function PrepareMoreChannelsButton({
  masterDesignId,
  excludeChannels,
  inline = false,
  label = "Prepare Campaign",
}: {
  masterDesignId: string;
  excludeChannels: Channel[];
  inline?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {inline ? (
        <button type="button" onClick={() => setOpen(true)} className="underline underline-offset-2">
          {label}
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Layers />
          {label}
        </Button>
      )}
      <ChannelPickerDialog masterDesignId={masterDesignId} excludeChannels={excludeChannels} open={open} onOpenChange={setOpen} />
    </>
  );
}
