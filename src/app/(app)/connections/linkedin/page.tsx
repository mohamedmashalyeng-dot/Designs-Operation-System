import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationCard } from "@/components/connections/integration-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "LinkedIn" };

export default function LinkedInConnectionPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="LinkedIn" description="Publish to LinkedIn Pages." />
      <IntegrationCard
        icon={Briefcase}
        name="LinkedIn"
        description="Requires LinkedIn's Marketing API and partner access — architecture in place, not wired up yet."
        statusLabel="Not connected"
        statusTone="neutral"
      >
        <Button disabled className="w-full">
          Connect LinkedIn
        </Button>
      </IntegrationCard>
    </div>
  );
}
