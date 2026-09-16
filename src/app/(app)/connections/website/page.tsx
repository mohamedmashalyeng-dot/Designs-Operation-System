import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Website" };

export default function WebsiteConnectionPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Website" description="Publish creative directly to your website (e.g. via WordPress)." />
      <IntegrationCard
        icon={Globe}
        name="Website"
        description="Provider-specific (e.g. WordPress REST API) — architecture in place, not wired up yet."
        statusLabel="Not connected"
        statusTone="neutral"
      >
        <Button disabled className="w-full">
          Connect Website
        </Button>
      </IntegrationCard>
    </div>
  );
}
