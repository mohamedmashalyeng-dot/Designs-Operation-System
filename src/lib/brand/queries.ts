import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { getSignedUrls } from "@/lib/storage/signed-url";

/** MVP assumes one primary brand per organisation — see brand-context.ts. */
export async function getPrimaryBrand(
  supabase: SupabaseClient<Database>,
  organisationId: string
): Promise<Tables<"brands"> | null> {
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getBrandRules(supabase: SupabaseClient<Database>, brandId: string): Promise<Tables<"brand_rules">[]> {
  const { data } = await supabase.from("brand_rules").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getAudiences(supabase: SupabaseClient<Database>, brandId: string): Promise<Tables<"audiences">[]> {
  const { data } = await supabase.from("audiences").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getProducts(supabase: SupabaseClient<Database>, brandId: string): Promise<Tables<"products">[]> {
  const { data } = await supabase.from("products").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
  return data ?? [];
}

export interface BrandAssetWithUrl extends Tables<"brand_assets"> {
  url: string | null;
}

export async function getBrandAssets(supabase: SupabaseClient<Database>, brandId: string): Promise<BrandAssetWithUrl[]> {
  const { data } = await supabase.from("brand_assets").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
  const assets = data ?? [];
  const signedUrls = await getSignedUrls(supabase, "brand-assets", assets.map((a) => a.storage_path));
  return assets.map((a) => ({ ...a, url: signedUrls.get(a.storage_path) ?? null }));
}
