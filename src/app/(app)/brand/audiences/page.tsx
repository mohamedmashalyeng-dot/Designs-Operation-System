import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getAudiences, getPrimaryBrand } from "@/lib/brand/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AudienceManager } from "@/components/brand/audience-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Audiences" };

async function getOrganisationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.organisation_id ?? null;
}

export default async function AudiencesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const organisationId = await getOrganisationId(supabase, user.id);
  const brand = organisationId ? await getPrimaryBrand(supabase, organisationId) : null;
  const audiences = brand ? await getAudiences(supabase, brand.id) : [];

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Audiences" description="Who campaigns are speaking to, and what moves them." />
      {brand ? (
        <AudienceManager brandId={brand.id} audiences={audiences} />
      ) : (
        <EmptyState
          icon={Users}
          title="Set up your brand first"
          description="Audiences attach to a brand profile."
          action={
            <Button size="sm" render={<Link href="/brand" />} nativeButton={false}>
              Set up brand
            </Button>
          }
        />
      )}
    </div>
  );
}
