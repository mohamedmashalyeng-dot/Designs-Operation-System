import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Meta" };

export default function MetaConnectionPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Meta" description="Publish to Instagram and Facebook." />
      <IntegrationCard
        icon={Share2}
        name="Meta (Instagram & Facebook)"
        description="Requires the Meta Graph API and app review — architecture in place, not wired up yet."
        statusLabel="Not connected"
        statusTone="neutral"
      >
        <Button disabled className="w-full">
          Connect Meta
        </Button>
      </IntegrationCard>
    </div>
  );
}
