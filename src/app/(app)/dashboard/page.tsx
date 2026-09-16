import Link from "next/link";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Plus, Sparkles, ClipboardCheck, FolderKanban, CheckCircle2, Send, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveCampaigns, getDesignsByStatus, getRecentDesigns } from "@/lib/creative/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignCard } from "@/components/creative/campaign-card";
import { CreativeCard } from "@/components/creative/creative-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

function Section({
  title,
  icon: Icon,
  viewAllHref,
  children,
}: {
  title: string;
  icon: LucideIcon;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {title}
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function CreativeGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{children}</div>;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [awaitingReview, activeCampaigns, recentDesigns, approved] = await Promise.all([
    getDesignsByStatus(supabase, ["ai_review", "human_review", "changes_requested"], 6),
    getActiveCampaigns(supabase, 6),
    getRecentDesigns(supabase, 6),
    getDesignsByStatus(supabase, ["approved"], 4),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        description="Your creative workflow at a glance."
        action={
          <Button render={<Link href="/create" />} nativeButton={false}>
            <Plus />
            New Campaign
          </Button>
        }
      />

      <Section title="Awaiting your review" icon={ClipboardCheck} viewAllHref={awaitingReview.length ? "/review" : undefined}>
        {awaitingReview.length ? (
          <CreativeGrid>
            {awaitingReview.map((design) => (
              <CreativeCard key={design.id} design={design} />
            ))}
          </CreativeGrid>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing needs review right now"
            description="Generated creatives will show up here as soon as they're ready for a decision."
          />
        )}
      </Section>

      <Section title="Active campaigns" icon={FolderKanban} viewAllHref={activeCampaigns.length ? "/library" : undefined}>
        {activeCampaigns.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No campaigns yet"
            description="Start with a simple idea — the AI Creative Director will turn it into a brief, concepts, and visuals."
            action={
              <Button size="sm" render={<Link href="/create" />} nativeButton={false}>
                Create your first campaign
              </Button>
            }
          />
        )}
      </Section>

      <Section title="Recently generated" icon={Sparkles} viewAllHref={recentDesigns.length ? "/library" : undefined}>
        {recentDesigns.length ? (
          <CreativeGrid>
            {recentDesigns.map((design) => (
              <CreativeCard key={design.id} design={design} />
            ))}
          </CreativeGrid>
        ) : (
          <EmptyState icon={Sparkles} title="No creatives generated yet" description="Generated visuals will appear here." />
        )}
      </Section>

      <Section title="Approved" icon={CheckCircle2} viewAllHref={approved.length ? "/review/approved" : undefined}>
        {approved.length ? (
          <CreativeGrid>
            {approved.map((design) => (
              <CreativeCard key={design.id} design={design} />
            ))}
          </CreativeGrid>
        ) : (
          <EmptyState icon={CheckCircle2} title="Nothing approved yet" description="Approved creatives are ready to resize, schedule, and publish." />
        )}
      </Section>

      <Section title="Scheduled & published" icon={Send}>
        <EmptyState
          icon={Send}
          title="Publishing isn't connected yet"
          description="Connect a channel under Connections to schedule and publish approved creatives directly from Creative Ops."
        />
      </Section>
    </div>
  );
}
