import type { Metadata } from "next";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getPrimaryBrand } from "@/lib/brand/queries";
import { PageHeader } from "@/components/shared/page-header";
import { BrandIdentityForm } from "@/components/brand/brand-identity-form";

export const metadata: Metadata = { title: "Brand" };

async function getOrganisationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.organisation_id ?? null;
}

export default async function BrandPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const organisationId = await getOrganisationId(supabase, user.id);
  const brand = organisationId ? await getPrimaryBrand(supabase, organisationId) : null;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        title="Brand"
        description="The identity the AI Creative Director draws on for every campaign."
      />
      <BrandIdentityForm brand={brand} />
    </div>
  );
}
