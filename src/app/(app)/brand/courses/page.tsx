import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getAudiences, getPrimaryBrand, getProducts } from "@/lib/brand/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductManager } from "@/components/brand/product-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Courses" };

async function getOrganisationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.organisation_id ?? null;
}

export default async function CoursesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const organisationId = await getOrganisationId(supabase, user.id);
  const brand = organisationId ? await getPrimaryBrand(supabase, organisationId) : null;
  const [products, audiences] = brand
    ? await Promise.all([getProducts(supabase, brand.id), getAudiences(supabase, brand.id)])
    : [[], []];

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Courses" description="Products, courses, or offerings campaigns can promote." />
      {brand ? (
        <ProductManager brandId={brand.id} products={products} audiences={audiences} />
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="Set up your brand first"
          description="Courses and products attach to a brand profile."
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
