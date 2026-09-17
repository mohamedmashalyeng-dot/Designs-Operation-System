import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Channel, Tables } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadAsBase64 } from "@/lib/storage/download";
import { getSignedUrl } from "@/lib/storage/signed-url";
import { extensionForMimeType } from "@/lib/storage/paths";
import { CHANNEL_CONNECTION_PROVIDER, getPublisher } from "./index";

/** `requireApproved: false` skips the status gate — used when processing a
 * job that was already validated as eligible at schedule-time (its design
 * has since moved to "scheduled", which would otherwise fail this check). */
async function loadDesignForPublishing(supabase: SupabaseClient<Database>, designId: string, requireApproved = true) {
  const { data: design, error: designError } = await supabase.from("designs").select("*").eq("id", designId).single();
  if (designError || !design) throw new Error("Design not found");
  if (requireApproved && design.status !== "approved") throw new Error("Only approved designs can be published.");
  if (!design.current_version_id) throw new Error("This design has no approved version.");

  const { data: version, error: versionError } = await supabase
    .from("design_versions")
    .select("*")
    .eq("id", design.current_version_id)
    .single();
  if (versionError || !version?.generated_asset_id) throw new Error("Approved version has no image.");

  const { data: asset, error: assetError } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("id", version.generated_asset_id)
    .single();
  if (assetError || !asset?.storage_path) throw new Error("Generated image not found in storage.");

  const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("organisation_id").eq("id", design.campaign_id).single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  return { design, version, asset, organisationId: campaign.organisation_id };
}

async function getConnectionForChannel(organisationId: string, channel: Channel): Promise<Tables<"connections">> {
  const provider = CHANNEL_CONNECTION_PROVIDER[channel];
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("connections")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("provider", provider)
    .maybeSingle();
  if (!connection || connection.status !== "connected") {
    throw new Error(`No connected ${provider} account for this workspace. Connect it under Connections first.`);
  }
  return connection;
}

/** Publishes immediately. Creates the publication_jobs row itself so a
 * failure still leaves an auditable, retryable record rather than nothing. */
export async function publishNow(
  supabase: SupabaseClient<Database>,
  params: { designId: string; channel: Channel }
): Promise<{ jobId: string; externalUrl: string }> {
  const { design, version, asset, organisationId } = await loadDesignForPublishing(supabase, params.designId);
  const connection = await getConnectionForChannel(organisationId, params.channel);

  const { data: job, error: jobError } = await supabase
    .from("publication_jobs")
    .insert({ design_id: design.id, connection_id: connection.id, channel: params.channel, status: "publishing" })
    .select()
    .single();
  if (jobError || !job) throw new Error(jobError?.message ?? "Failed to create the publish job");

  try {
    const admin = createAdminClient();
    const { base64, mimeType } = await downloadAsBase64(admin, "generated-images", asset.storage_path!);
    const imageUrl = await getSignedUrl(supabase, "generated-images", asset.storage_path!, 900);

    const publisher = getPublisher(params.channel);
    const result = await publisher(connection, {
      headline: version.headline,
      supportingCopy: version.supporting_copy,
      cta: version.cta,
      imageBytes: Buffer.from(base64, "base64"),
      imageMimeType: mimeType,
      imageFileName: `${design.title.slice(0, 40)}.${extensionForMimeType(mimeType)}`,
      imageUrl,
    });

    await supabase.from("publication_jobs").update({ status: "published" }).eq("id", job.id);
    await supabase.from("published_posts").insert({
      publication_job_id: job.id,
      design_id: design.id,
      connection_id: connection.id,
      external_post_id: result.externalPostId,
      external_url: result.externalUrl,
    });
    await supabase.from("designs").update({ status: "published" }).eq("id", design.id);

    return { jobId: job.id, externalUrl: result.externalUrl };
  } catch (error) {
    await supabase
      .from("publication_jobs")
      .update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown error" })
      .eq("id", job.id);
    throw error;
  }
}

/** Queues for later — src/app/api/cron/publish-scheduled/route.ts is what
 * actually fires these when `scheduled_for` arrives, and needs a real
 * external scheduler (Vercel Cron or similar) pointed at it once deployed;
 * nothing in this dev environment fires it on its own. */
export async function scheduleForLater(
  supabase: SupabaseClient<Database>,
  params: { designId: string; channel: Channel; scheduledFor: Date }
): Promise<{ jobId: string }> {
  const { design, organisationId } = await loadDesignForPublishing(supabase, params.designId);
  const connection = await getConnectionForChannel(organisationId, params.channel);

  const { data: job, error } = await supabase
    .from("publication_jobs")
    .insert({
      design_id: design.id,
      connection_id: connection.id,
      channel: params.channel,
      status: "scheduled",
      scheduled_for: params.scheduledFor.toISOString(),
    })
    .select()
    .single();
  if (error || !job) throw new Error(error?.message ?? "Failed to schedule the post");

  await supabase.from("designs").update({ status: "scheduled" }).eq("id", design.id);
  return { jobId: job.id };
}

/** Processes every due scheduled job — called by the cron route. Each job
 * is handled independently so one failure doesn't block the rest. */
export async function processDueJobs(): Promise<{ processed: number; failed: number }> {
  const admin = createAdminClient();
  const { data: dueJobs } = await admin
    .from("publication_jobs")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString());

  let processed = 0;
  let failed = 0;

  for (const job of dueJobs ?? []) {
    try {
      await admin.from("publication_jobs").update({ status: "publishing" }).eq("id", job.id);
      const { design, version, asset } = await loadDesignForPublishing(admin, job.design_id, false);

      const { data: connection } = await admin.from("connections").select("*").eq("id", job.connection_id).single();
      if (!connection) throw new Error("Connection no longer exists");

      const { base64, mimeType } = await downloadAsBase64(admin, "generated-images", asset.storage_path!);
      const imageUrl = await getSignedUrl(admin, "generated-images", asset.storage_path!, 900);

      const publisher = getPublisher(job.channel);
      const result = await publisher(connection, {
        headline: version.headline,
        supportingCopy: version.supporting_copy,
        cta: version.cta,
        imageBytes: Buffer.from(base64, "base64"),
        imageMimeType: mimeType,
        imageFileName: `${design.title.slice(0, 40)}.${extensionForMimeType(mimeType)}`,
        imageUrl,
      });

      await admin.from("publication_jobs").update({ status: "published" }).eq("id", job.id);
      await admin.from("published_posts").insert({
        publication_job_id: job.id,
        design_id: job.design_id,
        connection_id: job.connection_id,
        external_post_id: result.externalPostId,
        external_url: result.externalUrl,
      });
      await admin.from("designs").update({ status: "published" }).eq("id", job.design_id);
      processed += 1;
    } catch (error) {
      failed += 1;
      await admin
        .from("publication_jobs")
        .update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown error" })
        .eq("id", job.id);
    }
  }

  return { processed, failed };
}

/** Retries one failed job in place (product spec §34) — reuses the same
 * job row rather than creating a new one, so the Calendar/Published
 * history stays a single thread per attempt rather than forking. */
export async function retryJob(supabase: SupabaseClient<Database>, jobId: string): Promise<{ externalUrl: string }> {
  const { data: job, error: jobError } = await supabase.from("publication_jobs").select("*").eq("id", jobId).single();
  if (jobError || !job) throw new Error("Publication job not found");
  if (job.status !== "failed") throw new Error("Only a failed job can be retried.");

  await supabase.from("publication_jobs").update({ status: "publishing", error_message: null }).eq("id", job.id);

  try {
    const { design, version, asset } = await loadDesignForPublishing(supabase, job.design_id, false);
    const { data: connection } = await supabase.from("connections").select("*").eq("id", job.connection_id).single();
    if (!connection) throw new Error("Connection no longer exists — reconnect it under Connections.");

    const admin = createAdminClient();
    const { base64, mimeType } = await downloadAsBase64(admin, "generated-images", asset.storage_path!);
    const imageUrl = await getSignedUrl(supabase, "generated-images", asset.storage_path!, 900);

    const publisher = getPublisher(job.channel);
    const result = await publisher(connection, {
      headline: version.headline,
      supportingCopy: version.supporting_copy,
      cta: version.cta,
      imageBytes: Buffer.from(base64, "base64"),
      imageMimeType: mimeType,
      imageFileName: `${design.title.slice(0, 40)}.${extensionForMimeType(mimeType)}`,
      imageUrl,
    });

    await supabase.from("publication_jobs").update({ status: "published" }).eq("id", job.id);
    await supabase.from("published_posts").insert({
      publication_job_id: job.id,
      design_id: job.design_id,
      connection_id: job.connection_id,
      external_post_id: result.externalPostId,
      external_url: result.externalUrl,
    });
    await supabase.from("designs").update({ status: "published" }).eq("id", job.design_id);

    return { externalUrl: result.externalUrl };
  } catch (error) {
    await supabase
      .from("publication_jobs")
      .update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown error" })
      .eq("id", job.id);
    throw error;
  }
}

/** Cancels a not-yet-fired scheduled/queued job (product spec §32) — the
 * design goes back to "approved" so it's still publishable from scratch. */
export async function cancelJob(supabase: SupabaseClient<Database>, jobId: string): Promise<void> {
  const { data: job, error } = await supabase.from("publication_jobs").select("*").eq("id", jobId).single();
  if (error || !job) throw new Error("Publication job not found");
  if (job.status !== "scheduled" && job.status !== "queued") throw new Error("Only a scheduled job can be cancelled.");

  await supabase.from("publication_jobs").update({ status: "cancelled" }).eq("id", job.id);
  await supabase.from("designs").update({ status: "approved" }).eq("id", job.design_id);
}

/** Moves a scheduled or failed job to a new time (product spec §32). */
export async function rescheduleJob(supabase: SupabaseClient<Database>, jobId: string, scheduledFor: Date): Promise<void> {
  const { data: job, error } = await supabase.from("publication_jobs").select("*").eq("id", jobId).single();
  if (error || !job) throw new Error("Publication job not found");
  if (job.status !== "scheduled" && job.status !== "failed") throw new Error("Only a scheduled or failed job can be rescheduled.");

  await supabase.from("publication_jobs").update({ status: "scheduled", scheduled_for: scheduledFor.toISOString(), error_message: null }).eq("id", job.id);
  await supabase.from("designs").update({ status: "scheduled" }).eq("id", job.design_id);
}
