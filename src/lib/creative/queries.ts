import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetStatus, Database, DesignStatus, Tables } from "@/types/database";
import type { ImageReview } from "@/lib/ai/schemas";
import { getSignedUrl, getSignedUrls } from "@/lib/storage/signed-url";

/**
 * Read helpers shared by the Dashboard, Review queue, and Creative
 * Library. None of these filter by organisation explicitly — Row Level
 * Security already scopes every query to the caller's organisation
 * (see `is_member_of_org` in supabase/migrations/0001_core.sql), so the
 * app code stays simple and the database remains the actual boundary.
 */

export interface DesignSummary {
  id: string;
  title: string;
  status: DesignStatus;
  campaignId: string;
  campaignTitle: string;
  formatId: string;
  headline: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
}

async function toDesignSummaries(
  supabase: SupabaseClient<Database>,
  designs: Tables<"designs">[]
): Promise<DesignSummary[]> {
  if (designs.length === 0) return [];

  const campaignIds = [...new Set(designs.map((d) => d.campaign_id))];
  const versionIds = [...new Set(designs.map((d) => d.current_version_id).filter((v): v is string => Boolean(v)))];

  const [{ data: campaigns }, { data: versions }] = await Promise.all([
    supabase.from("campaigns").select("id, title").in("id", campaignIds),
    versionIds.length
      ? supabase.from("design_versions").select("id, headline, generated_asset_id").in("id", versionIds)
      : Promise.resolve({ data: [] as { id: string; headline: string; generated_asset_id: string | null }[] }),
  ]);

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const versionById = new Map((versions ?? []).map((v) => [v.id, v]));

  const assetIds = [...new Set([...versionById.values()].map((v) => v.generated_asset_id).filter((a): a is string => Boolean(a)))];
  const { data: assets } = assetIds.length
    ? await supabase.from("generated_assets").select("id, storage_path").in("id", assetIds)
    : { data: [] as { id: string; storage_path: string | null }[] };
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  const paths = [...assetById.values()].map((a) => a.storage_path).filter((p): p is string => Boolean(p));
  const signedUrls = await getSignedUrls(supabase, "generated-images", paths);

  return designs.map((design) => {
    const version = design.current_version_id ? versionById.get(design.current_version_id) : undefined;
    const asset = version?.generated_asset_id ? assetById.get(version.generated_asset_id) : undefined;
    return {
      id: design.id,
      title: design.title,
      status: design.status,
      campaignId: design.campaign_id,
      campaignTitle: campaignById.get(design.campaign_id)?.title ?? "Untitled campaign",
      formatId: design.format_id,
      headline: version?.headline ?? null,
      thumbnailUrl: asset?.storage_path ? (signedUrls.get(asset.storage_path) ?? null) : null,
      updatedAt: design.updated_at,
    };
  });
}

export async function getDesignsByStatus(
  supabase: SupabaseClient<Database>,
  statuses: DesignStatus[],
  limit = 24
): Promise<DesignSummary[]> {
  const { data } = await supabase
    .from("designs")
    .select("*")
    .in("status", statuses)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return toDesignSummaries(supabase, data ?? []);
}

export async function getDesignsForCampaign(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<DesignSummary[]> {
  const { data } = await supabase
    .from("designs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  return toDesignSummaries(supabase, data ?? []);
}

export async function getRecentDesigns(supabase: SupabaseClient<Database>, limit = 8): Promise<DesignSummary[]> {
  const { data } = await supabase.from("designs").select("*").order("updated_at", { ascending: false }).limit(limit);
  return toDesignSummaries(supabase, data ?? []);
}

export async function getActiveCampaigns(
  supabase: SupabaseClient<Database>,
  limit = 6
): Promise<Tables<"campaigns">[]> {
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .not("status", "in", "(completed,archived)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getAllCampaigns(supabase: SupabaseClient<Database>, limit = 50): Promise<Tables<"campaigns">[]> {
  const { data } = await supabase.from("campaigns").select("*").order("updated_at", { ascending: false }).limit(limit);
  return data ?? [];
}

export interface DesignVersionSummary {
  id: string;
  versionNumber: number;
  headline: string;
  supportingCopy: string;
  cta: string;
  layoutPreset: string;
  changeDescription: string;
  changedByAI: boolean;
  createdAt: string;
  thumbnailUrl: string | null;
  aiReview: ImageReview | null;
  assetStatus: AssetStatus | null;
  assetErrorMessage: string | null;
}

export interface DesignDetail {
  design: Tables<"designs">;
  campaignId: string;
  campaignTitle: string;
  conceptName: string;
  currentVersion: DesignVersionSummary | null;
  versions: DesignVersionSummary[];
  feedback: Tables<"feedback">[];
}

export interface PendingVariation {
  assetId: string;
  thumbnailUrl: string | null;
  label: string;
  status: AssetStatus;
  errorMessage: string | null;
}

export interface PendingVariationsBatch {
  designId: string;
  formatId: string;
  variations: PendingVariation[];
  headline: string;
  supportingCopy: string;
  cta: string;
  layoutPreset: string;
}

/** The generated_assets from a design's most recent `generateVariations`
 * batch that haven't been attached to a version yet — backs the "choose
 * your favourite" screen. Scoped via `designs.latest_batch_id` rather than
 * concept_id, since two designs (the original + any format adaptation) can
 * share a concept and both have in-flight batches at once. */
export async function getPendingVariations(
  supabase: SupabaseClient<Database>,
  designId: string
): Promise<PendingVariationsBatch | null> {
  const { data: design } = await supabase.from("designs").select("*").eq("id", designId).single();
  if (!design || !design.latest_batch_id) return null;

  const { data: assets } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("generation_batch_id", design.latest_batch_id)
    .is("design_version_id", null)
    .order("created_at", { ascending: true });
  if (!assets || assets.length === 0) return null;

  const paths = assets.map((a) => a.storage_path).filter((p): p is string => Boolean(p));
  const signedUrls = await getSignedUrls(supabase, "generated-images", paths);

  const [{ data: concept }, { data: currentVersion }] = await Promise.all([
    supabase.from("creative_concepts").select("*").eq("id", design.concept_id).single(),
    design.current_version_id
      ? supabase.from("design_versions").select("headline, supporting_copy, cta, layout_preset").eq("id", design.current_version_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    designId: design.id,
    formatId: design.format_id,
    variations: assets.map((a) => ({
      assetId: a.id,
      thumbnailUrl: a.storage_path ? (signedUrls.get(a.storage_path) ?? null) : null,
      label: a.status === "failed" ? "Failed" : "Visual option",
      status: a.status,
      errorMessage: a.error_message,
    })),
    headline: currentVersion?.headline ?? concept?.headline ?? design.title,
    supportingCopy: currentVersion?.supporting_copy ?? concept?.supporting_copy ?? "",
    cta: currentVersion?.cta ?? concept?.cta ?? "Learn more",
    layoutPreset: currentVersion?.layout_preset ?? "bottom_message",
  };
}

export async function getDesignDetail(
  supabase: SupabaseClient<Database>,
  designId: string
): Promise<DesignDetail | null> {
  const { data: design } = await supabase.from("designs").select("*").eq("id", designId).single();
  if (!design) return null;

  const [{ data: campaign }, { data: concept }, { data: versions }, { data: feedback }] = await Promise.all([
    supabase.from("campaigns").select("title").eq("id", design.campaign_id).single(),
    supabase.from("creative_concepts").select("name").eq("id", design.concept_id).single(),
    supabase.from("design_versions").select("*").eq("design_id", designId).order("version_number", { ascending: false }),
    supabase.from("feedback").select("*").eq("design_id", designId).order("created_at", { ascending: false }),
  ]);

  const versionRows = versions ?? [];
  const assetIds = [...new Set(versionRows.map((v) => v.generated_asset_id).filter((a): a is string => Boolean(a)))];
  const { data: assets } = assetIds.length
    ? await supabase.from("generated_assets").select("id, storage_path, status, error_message").in("id", assetIds)
    : { data: [] as { id: string; storage_path: string | null; status: AssetStatus; error_message: string | null }[] };
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  const paths = [...assetById.values()].map((a) => a.storage_path).filter((p): p is string => Boolean(p));
  const signedUrls = await getSignedUrls(supabase, "generated-images", paths);

  const versionSummaries: DesignVersionSummary[] = versionRows.map((v) => {
    const asset = v.generated_asset_id ? assetById.get(v.generated_asset_id) : undefined;
    return {
      id: v.id,
      versionNumber: v.version_number,
      headline: v.headline,
      supportingCopy: v.supporting_copy,
      cta: v.cta,
      layoutPreset: v.layout_preset,
      changeDescription: v.change_description,
      changedByAI: v.changed_by_ai,
      createdAt: v.created_at,
      thumbnailUrl: asset?.storage_path ? (signedUrls.get(asset.storage_path) ?? null) : null,
      aiReview: (v.ai_review as ImageReview | null) ?? null,
      assetStatus: asset?.status ?? null,
      assetErrorMessage: asset?.error_message ?? null,
    };
  });

  return {
    design,
    campaignId: design.campaign_id,
    campaignTitle: campaign?.title ?? "Untitled campaign",
    conceptName: concept?.name ?? "Concept",
    currentVersion: versionSummaries.find((v) => v.id === design.current_version_id) ?? versionSummaries[0] ?? null,
    versions: versionSummaries,
    feedback: feedback ?? [],
  };
}

/** Signs a single generated-asset thumbnail — used where only one image is
 * needed (e.g. re-fetching after an action) rather than the batch path. */
export async function getAssetThumbnailUrl(
  supabase: SupabaseClient<Database>,
  storagePath: string | null
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    return await getSignedUrl(supabase, "generated-images", storagePath, 3600);
  } catch {
    return null;
  }
}

/** All channel-adapted versions prepared from an approved master design
 * (product spec §27/§28) — backs the grouped "Final Campaign Review" screen. */
export async function getChannelVersions(supabase: SupabaseClient<Database>, masterDesignId: string): Promise<DesignSummary[]> {
  const { data } = await supabase.from("designs").select("*").eq("master_design_id", masterDesignId).order("created_at", { ascending: true });
  return toDesignSummaries(supabase, data ?? []);
}

export async function countDesignsByStatus(
  supabase: SupabaseClient<Database>,
  statuses: DesignStatus[]
): Promise<number> {
  const { count } = await supabase
    .from("designs")
    .select("id", { count: "exact", head: true })
    .in("status", statuses);
  return count ?? 0;
}
