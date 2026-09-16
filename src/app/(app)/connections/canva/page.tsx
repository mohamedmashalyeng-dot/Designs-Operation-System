import type { Metadata } from "next";
import { CheckCircle2, Palette, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { ConnectCanvaButton, DisconnectCanvaButton } from "@/components/connections/canva-connection-actions";
import { createClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/connections/queries";
import { getCanvaOAuthConfig } from "@/lib/canva/oauth";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Canva" };

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Canva isn't configured on the server yet (CANVA_CLIENT_ID / CANVA_CLIENT_SECRET missing).",
  invalid_state: "The connection attempt expired or failed a security check. Please try again.",
  exchange_failed: "Canva rejected the connection request. Please try again.",
};

export default async function CanvaConnectionPage({
  searchParams,
}: PageProps<"/connections/canva">) {
  const params = await searchParams;
  const supabase = await createClient();
  const connection = await getConnection(supabase, "canva");
  const configured = Boolean(getCanvaOAuthConfig());

  const connected = connection?.status === "connected";
  const error = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : null;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Canva" description="Advanced manual design editing for AI-generated creative." />

      {params.connected && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          Canva connected successfully.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      <IntegrationCard
        icon={Palette}
        name="Canva"
        description="Send a generated creative to Canva for manual editing, then sync it back."
        statusLabel={connected ? "Connected" : "Not connected"}
        statusTone={connected ? "success" : "neutral"}
      >
        <div className="space-y-3">
          {connected ? (
            <>
              {connection?.updatedAt && (
                <p className="text-xs text-muted-foreground">Connected {formatDateTime(connection.updatedAt)}</p>
              )}
              <DisconnectCanvaButton />
            </>
          ) : (
            <>
              {!configured && (
                <p className="text-xs text-muted-foreground">
                  Server isn&apos;t configured yet — add <code className="rounded bg-muted px-1 py-0.5">CANVA_CLIENT_ID</code>,{" "}
                  <code className="rounded bg-muted px-1 py-0.5">CANVA_CLIENT_SECRET</code>, and{" "}
                  <code className="rounded bg-muted px-1 py-0.5">CANVA_REDIRECT_URI</code> from a{" "}
                  <a href="https://www.canva.com/developers/" target="_blank" rel="noreferrer" className="underline">
                    Canva developer integration
                  </a>{" "}
                  to enable this.
                </p>
              )}
              <ConnectCanvaButton configured={configured} />
            </>
          )}
        </div>
      </IntegrationCard>

      <div className="space-y-3 rounded-lg border p-5 text-sm">
        <p className="font-medium">What this integration does today</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>Uploads a generated creative into Canva and opens it as a new, editable design.</li>
          <li>Lets you sync your manual Canva edits back in as a new version, once you return.</li>
        </ul>
        <p className="pt-2 font-medium">Not implemented in this phase</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>
            Brand Template autofill — Canva Brand Templates must be created manually inside Canva first; there&apos;s no
            API to define one, so this needs a per-workspace setup step we haven&apos;t built yet.
          </li>
          <li>Full cryptographic verification of Canva&apos;s return-navigation signature (currently decoded, not verified).</li>
        </ul>
      </div>
    </div>
  );
}
