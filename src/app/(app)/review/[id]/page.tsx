import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDesignDetail } from "@/lib/creative/queries";
import { DesignReviewPanel } from "@/components/creative/design-review-panel";

export const metadata: Metadata = { title: "Review Creative" };

export default async function DesignReviewPage({ params }: PageProps<"/review/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [detail, { data: design }] = await Promise.all([
    getDesignDetail(supabase, id),
    supabase.from("designs").select("canva_design_id").eq("id", id).single(),
  ]);

  if (!detail) notFound();

  return <DesignReviewPanel detail={detail} canvaDesignId={design?.canva_design_id ?? null} />;
}
