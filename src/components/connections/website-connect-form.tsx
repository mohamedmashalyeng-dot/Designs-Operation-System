"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Unplug, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { connectWordPressAction, disconnectWebsiteAction } from "@/lib/actions/connections";

export function ConnectWebsiteButton() {
  const [open, setOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      const result = await connectWordPressAction({ siteUrl, username, applicationPassword });
      if (result?.error) setError(result.error);
      else {
        toast.success("WordPress connected");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Globe />
        Connect Website
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect your WordPress site</DialogTitle>
            <DialogDescription>
              Uses a WordPress Application Password (Users → Profile → Application Passwords in your WP admin) — no OAuth app
              needed. Self-hosted WordPress only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wp-site-url">Site URL</Label>
              <Input id="wp-site-url" placeholder="https://yoursite.com" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wp-username">Username</Label>
              <Input id="wp-username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wp-app-password">Application password</Label>
              <Input
                id="wp-app-password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={applicationPassword}
                onChange={(e) => setApplicationPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={pending || !siteUrl || !username || !applicationPassword}>
              {pending && <Loader2 className="animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DisconnectWebsiteButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await disconnectWebsiteAction();
      if (result?.error) toast.error(result.error);
      else toast.success("Website disconnected");
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : <Unplug />}
      Disconnect
    </Button>
  );
}
