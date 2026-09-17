import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { ConnectWebsiteButton, DisconnectWebsiteButton } from "@/components/connections/website-connect-form";
import { createClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/connections/queries";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Website" };

export default async function WebsiteConnectionPage() {
  const supabase = await createClient();
  const connection = await getConnection(supabase, "website");
  const connected = connection?.status === "connected";

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Website" description="Publish creative directly to your self-hosted WordPress site." />
      <IntegrationCard
        icon={Globe}
        name="WordPress"
        description="Publishes as a new post with a featured image, via the WordPress REST API."
        statusLabel={connected ? "Connected" : "Not connected"}
        statusTone={connected ? "success" : "neutral"}
      >
        <div className="space-y-3">
          {connected ? (
            <>
              {connection?.externalAccountName && <p className="text-xs text-muted-foreground">Site: {connection.externalAccountName}</p>}
              {connection?.updatedAt && <p className="text-xs text-muted-foreground">Since {formatDateTime(connection.updatedAt)}</p>}
              <DisconnectWebsiteButton />
            </>
          ) : (
            <ConnectWebsiteButton />
          )}
        </div>
      </IntegrationCard>

      <div className="space-y-3 rounded-lg border p-5 text-sm">
        <p className="font-medium">What this integration does today</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>Publishes an approved creative as a new WordPress post, with the generated image set as the featured image.</li>
        </ul>
        <p className="pt-2 font-medium">Requirements</p>
        <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
          <li>Self-hosted WordPress (5.6+) with the REST API reachable — not WordPress.com-hosted sites, which use a different OAuth-based flow.</li>
          <li>
            An Application Password: in your WP admin, go to Users → Profile → Application Passwords, name it (e.g. &quot;Creative Ops&quot;), and
            copy the generated password — it&apos;s shown once.
          </li>
        </ul>
      </div>
    </div>
  );
}
