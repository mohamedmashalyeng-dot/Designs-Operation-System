import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getBrandAssets, getPrimaryBrand } from "@/lib/brand/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AssetManager } from "@/components/brand/asset-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Brand Assets" };

async function getOrganisationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.organisation_id ?? null;
}

export default async function BrandAssetsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const organisationId = await getOrganisationId(supabase, user.id);
  const brand = organisationId ? await getPrimaryBrand(supabase, organisationId) : null;
  const assets = brand ? await getBrandAssets(supabase, brand.id) : [];

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Assets" description="Logos, reference images, and brand documents." />
      {brand ? (
        <AssetManager brandId={brand.id} assets={assets} />
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="Set up your brand first"
          description="Assets attach to a brand profile."
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
