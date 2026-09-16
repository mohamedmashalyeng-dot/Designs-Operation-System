import type { Metadata } from "next";
import { LibraryBig, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRecentDesigns, getAllCampaigns } from "@/lib/creative/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreativeCard } from "@/components/creative/creative-card";
import { CampaignCard } from "@/components/creative/campaign-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Creative Library" };

export default async function LibraryPage() {
  const supabase = await createClient();
  const [designs, campaigns] = await Promise.all([
    getRecentDesigns(supabase, 100),
    getAllCampaigns(supabase, 12),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Creative Library"
        description="Every campaign and creative generated in this workspace."
        action={
          <Button render={<Link href="/create" />} nativeButton={false}>
            <Plus />
            New Campaign
          </Button>
        }
      />

      {campaigns.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Campaigns</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">All creatives</h2>
        {designs.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {designs.map((design) => (
              <CreativeCard key={design.id} design={design} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={LibraryBig}
            title="Nothing generated yet"
            description="Creatives from every campaign will appear here once generated."
            action={
              <Button size="sm" render={<Link href="/create" />} nativeButton={false}>
                <Sparkles />
                Start your first campaign
              </Button>
            }
            className="py-24"
          />
        )}
      </section>
    </div>
  );
}
