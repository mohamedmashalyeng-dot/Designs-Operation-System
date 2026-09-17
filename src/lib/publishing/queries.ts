import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Channel, PublicationStatus } from "@/types/database";
import { getSignedUrls } from "@/lib/storage/signed-url";

export interface PublicationJobSummary {
  id: string;
  designId: string;
  designTitle: string;
  thumbnailUrl: string | null;
  channel: Channel;
  status: PublicationStatus;
  scheduledFor: string | null;
  errorMessage: string | null;
  createdAt: string;
}

async function toJobSummaries(
  supabase: SupabaseClient<Database>,
  jobs: Database["public"]["Tables"]["publication_jobs"]["Row"][]
): Promise<PublicationJobSummary[]> {
  if (jobs.length === 0) return [];

  const designIds = [...new Set(jobs.map((j) => j.design_id))];
  const { data: designs } = await supabase.from("designs").select("id, title, current_version_id").in("id", designIds);
  const designById = new Map((designs ?? []).map((d) => [d.id, d]));

  const versionIds = [...new Set((designs ?? []).map((d) => d.current_version_id).filter((v): v is string => Boolean(v)))];
  const { data: versions } = versionIds.length
    ? await supabase.from("design_versions").select("id, generated_asset_id").in("id", versionIds)
    : { data: [] as { id: string; generated_asset_id: string | null }[] };
  const versionById = new Map((versions ?? []).map((v) => [v.id, v]));

  const assetIds = [...new Set([...versionById.values()].map((v) => v.generated_asset_id).filter((a): a is string => Boolean(a)))];
  const { data: assets } = assetIds.length
    ? await supabase.from("generated_assets").select("id, storage_path").in("id", assetIds)
    : { data: [] as { id: string; storage_path: string | null }[] };
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  const paths = [...assetById.values()].map((a) => a.storage_path).filter((p): p is string => Boolean(p));
  const signedUrls = await getSignedUrls(supabase, "generated-images", paths);

  return jobs.map((job) => {
    const design = designById.get(job.design_id);
    const version = design?.current_version_id ? versionById.get(design.current_version_id) : undefined;
    const asset = version?.generated_asset_id ? assetById.get(version.generated_asset_id) : undefined;
    return {
      id: job.id,
      designId: job.design_id,
      designTitle: design?.title ?? "Untitled",
      thumbnailUrl: asset?.storage_path ? (signedUrls.get(asset.storage_path) ?? null) : null,
      channel: job.channel,
      status: job.status,
      scheduledFor: job.scheduled_for,
      errorMessage: job.error_message,
      createdAt: job.created_at,
    };
  });
}

/** Scheduled + in-flight jobs, soonest first — backs the Calendar page. */
export async function getUpcomingJobs(supabase: SupabaseClient<Database>, limit = 50): Promise<PublicationJobSummary[]> {
  const { data } = await supabase
    .from("publication_jobs")
    .select("*")
    .in("status", ["queued", "scheduled", "publishing"])
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(limit);
  return toJobSummaries(supabase, data ?? []);
}

/** Failed jobs — surfaced separately so they don't get lost among upcoming ones. */
export async function getFailedJobs(supabase: SupabaseClient<Database>, limit = 20): Promise<PublicationJobSummary[]> {
  const { data } = await supabase.from("publication_jobs").select("*").eq("status", "failed").order("updated_at", { ascending: false }).limit(limit);
  return toJobSummaries(supabase, data ?? []);
}

export interface PublishedPostSummary {
  id: string;
  designId: string;
  designTitle: string;
  thumbnailUrl: string | null;
  channel: Channel;
  externalUrl: string | null;
  publishedAt: string;
}

export async function getPublishedPosts(supabase: SupabaseClient<Database>, limit = 50): Promise<PublishedPostSummary[]> {
  const { data: posts } = await supabase.from("published_posts").select("*").order("published_at", { ascending: false }).limit(limit);
  if (!posts || posts.length === 0) return [];

  const designIds = [...new Set(posts.map((p) => p.design_id))];
  const { data: designs } = await supabase.from("designs").select("id, title, current_version_id").in("id", designIds);
  const designById = new Map((designs ?? []).map((d) => [d.id, d]));

  const jobIds = [...new Set(posts.map((p) => p.publication_job_id))];
  const { data: jobs } = await supabase.from("publication_jobs").select("id, channel").in("id", jobIds);
  const channelByJobId = new Map((jobs ?? []).map((j) => [j.id, j.channel]));

  const versionIds = [...new Set((designs ?? []).map((d) => d.current_version_id).filter((v): v is string => Boolean(v)))];
  const { data: versions } = versionIds.length
    ? await supabase.from("design_versions").select("id, generated_asset_id").in("id", versionIds)
    : { data: [] as { id: string; generated_asset_id: string | null }[] };
  const versionById = new Map((versions ?? []).map((v) => [v.id, v]));

  const assetIds = [...new Set([...versionById.values()].map((v) => v.generated_asset_id).filter((a): a is string => Boolean(a)))];
  const { data: assets } = assetIds.length
    ? await supabase.from("generated_assets").select("id, storage_path").in("id", assetIds)
    : { data: [] as { id: string; storage_path: string | null }[] };
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  const paths = [...assetById.values()].map((a) => a.storage_path).filter((p): p is string => Boolean(p));
  const signedUrls = await getSignedUrls(supabase, "generated-images", paths);

  return posts.map((post) => {
    const design = designById.get(post.design_id);
    const version = design?.current_version_id ? versionById.get(design.current_version_id) : undefined;
    const asset = version?.generated_asset_id ? assetById.get(version.generated_asset_id) : undefined;
    return {
      id: post.id,
      designId: post.design_id,
      designTitle: design?.title ?? "Untitled",
      thumbnailUrl: asset?.storage_path ? (signedUrls.get(asset.storage_path) ?? null) : null,
      channel: channelByJobId.get(post.publication_job_id) ?? "website",
      externalUrl: post.external_url,
      publishedAt: post.published_at,
    };
  });
}
