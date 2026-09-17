import type { Metadata } from "next";
import { CheckCircle2, Briefcase, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { ConnectLinkedInButton, DisconnectLinkedInButton } from "@/components/connections/linkedin-connection-actions";
import { createClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/connections/queries";
import { getLinkedInOAuthConfig } from "@/lib/linkedin/oauth";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "LinkedIn" };

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "LinkedIn isn't configured on the server yet (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, or LINKEDIN_REDIRECT_URI missing).",
  access_denied: "LinkedIn access wasn't approved. Select Connect LinkedIn to try again.",
  invalid_state: "The connection attempt expired or failed a security check. Please try again.",
  exchange_failed: "LinkedIn rejected the connection request. Please try again.",
};

export default async function LinkedInConnectionPage({ searchParams }: PageProps<"/connections/linkedin">) {
  const params = await searchParams;
  const supabase = await createClient();
  const connection = await getConnection(supabase, "linkedin");
  const configured = Boolean(getLinkedInOAuthConfig());

  const connected = connection?.status === "connected";
  const error = typeof params.error === "string" ? (ERROR_MESSAGES[params.error] ?? "The LinkedIn connection couldn't be completed. Please try again.") : null;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="LinkedIn" description="Publish approved creative to your LinkedIn profile." />

      {params.connected === "1" && connected && !error && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          LinkedIn connected successfully.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      <IntegrationCard
        icon={Briefcase}
        name="LinkedIn"
        description="Post to your own LinkedIn profile feed."
        statusLabel={connected ? "Connected" : "Not connected"}
        statusTone={connected ? "success" : "neutral"}
      >
        <div className="space-y-3">
          {connected ? (
            <>
              {connection?.externalAccountName && <p className="text-xs text-muted-foreground">Connected as {connection.externalAccountName}</p>}
              {connection?.updatedAt && <p className="text-xs text-muted-foreground">Since {formatDateTime(connection.updatedAt)}</p>}
              <DisconnectLinkedInButton />
            </>
          ) : (
            <>
              {!configured && (
                <p className="text-xs text-muted-foreground">
                  Server isn&apos;t configured yet — add <code className="rounded bg-muted px-1 py-0.5">LINKEDIN_CLIENT_ID</code>,{" "}
                  <code className="rounded bg-muted px-1 py-0.5">LINKEDIN_CLIENT_SECRET</code>, and{" "}
                  <code className="rounded bg-muted px-1 py-0.5">LINKEDIN_REDIRECT_URI</code> from a{" "}
                  <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer" className="underline">
                    LinkedIn developer app
                  </a>{" "}
                  (request the &quot;Share on LinkedIn&quot; product — self-serve, no review) to enable this.
                </p>
              )}
              <ConnectLinkedInButton configured={configured} />
            </>
          )}
        </div>
      </IntegrationCard>

      <div className="space-y-3 rounded-lg border p-5 text-sm">
        <p className="font-medium">What this integration does today</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>Publishes an approved creative directly to your own LinkedIn profile feed, immediately or scheduled.</li>
        </ul>
        <p className="pt-2 font-medium">Not implemented in this phase</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>
            Posting to a LinkedIn Company Page — requires the <code className="rounded bg-muted px-1 py-0.5">w_organization_social</code> scope, which
            needs a separate LinkedIn app review (access-request form, demo, sign-off call). Not self-serve.
          </li>
        </ul>
      </div>
    </div>
  );
}
