import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getBrandRules, getPrimaryBrand } from "@/lib/brand/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BrandRulesManager } from "@/components/brand/brand-rules-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Brand Rules" };

async function getOrganisationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.organisation_id ?? null;
}

export default async function BrandRulesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const organisationId = await getOrganisationId(supabase, user.id);
  const brand = organisationId ? await getPrimaryBrand(supabase, organisationId) : null;
  const rules = brand ? await getBrandRules(supabase, brand.id) : [];

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        title="Brand Rules"
        description="Hard constraints the AI Creative Director must respect in every brief."
      />
      {brand ? (
        <BrandRulesManager brandId={brand.id} rules={rules} />
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="Set up your brand first"
          description="Brand rules attach to a brand profile."
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
