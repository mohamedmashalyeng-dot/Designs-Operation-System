import type { Metadata } from "next";
import { CheckCircle2, Share2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { ConnectMetaButton, DisconnectMetaButton } from "@/components/connections/meta-connection-actions";
import { createClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/connections/queries";
import { getMetaOAuthConfig } from "@/lib/meta/oauth";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Meta" };

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Meta isn't configured on the server yet (META_APP_ID, META_APP_SECRET, or META_REDIRECT_URI missing).",
  access_denied: "Meta access wasn't approved. Select Connect Meta to try again.",
  invalid_state: "The connection attempt expired or failed a security check. Please try again.",
  exchange_failed: "Meta rejected the connection request. Please try again.",
};

export default async function MetaConnectionPage({ searchParams }: PageProps<"/connections/meta">) {
  const params = await searchParams;
  const supabase = await createClient();
  const connection = await getConnection(supabase, "meta");
  const configured = Boolean(getMetaOAuthConfig());

  const connected = connection?.status === "connected";
  const error = typeof params.error === "string" ? (ERROR_MESSAGES[params.error] ?? "The Meta connection couldn't be completed. Please try again.") : null;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Meta" description="Publish to Instagram and Facebook." />

      {params.connected === "1" && connected && !error && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          Meta connected successfully.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      <IntegrationCard
        icon={Share2}
        name="Meta (Facebook & Instagram)"
        description="Posts to the first Facebook Page you manage, and its linked Instagram Business account if any."
        statusLabel={connected ? "Connected" : "Not connected"}
        statusTone={connected ? "success" : "neutral"}
      >
        <div className="space-y-3">
          {connected ? (
            <>
              {connection?.externalAccountName && <p className="text-xs text-muted-foreground">Page: {connection.externalAccountName}</p>}
              {connection?.updatedAt && <p className="text-xs text-muted-foreground">Since {formatDateTime(connection.updatedAt)}</p>}
              <DisconnectMetaButton />
            </>
          ) : (
            <>
              {!configured && (
                <p className="text-xs text-muted-foreground">
                  Server isn&apos;t configured yet — add <code className="rounded bg-muted px-1 py-0.5">META_APP_ID</code>,{" "}
                  <code className="rounded bg-muted px-1 py-0.5">META_APP_SECRET</code>, and{" "}
                  <code className="rounded bg-muted px-1 py-0.5">META_REDIRECT_URI</code> from a{" "}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline">
                    Meta developer app
                  </a>{" "}
                  to enable this.
                </p>
              )}
              <ConnectMetaButton configured={configured} />
            </>
          )}
        </div>
      </IntegrationCard>

      <div className="space-y-3 rounded-lg border p-5 text-sm">
        <p className="font-medium">What this integration does today</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>Publishes an approved creative to a connected Facebook Page, and to its linked Instagram Business account if one exists.</li>
        </ul>
        <p className="pt-2 font-medium">Important limitation — read before connecting</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>
            Publishing permissions (<code className="rounded bg-muted px-1 py-0.5">pages_manage_posts</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5">instagram_content_publish</code>) require Meta&apos;s Advanced Access tier, which needs
            Business Verification followed by App Review — a multi-week process, not self-serve.
          </li>
          <li>
            Until that&apos;s complete, this only works for Facebook/Instagram accounts added as an Admin, Developer, or Tester on your Meta App —
            fine for your own accounts, not for other businesses&apos;.
          </li>
          <li>Only the first Page you manage is used — there&apos;s no page-picker yet if you manage more than one.</li>
        </ul>
      </div>
    </div>
  );
}
