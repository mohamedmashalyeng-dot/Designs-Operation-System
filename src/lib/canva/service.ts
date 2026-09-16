import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadAsBase64 } from "@/lib/storage/download";
import { generatedImagePath } from "@/lib/storage/paths";
import { getCanvaOAuthConfig, refreshCanvaToken } from "./oauth";
import { CanvaConnectProvider } from "./provider";
import { buildCorrelationState } from "./return-navigation";

const provider = new CanvaConnectProvider();

/** Reads/refreshes the stored Canva access token for an organisation.
 * Uses the admin client deliberately — the token columns are revoked
 * from the `authenticated` role (see 0006_connections_and_publishing.sql),
 * so this is the one legitimate server-side path that may read them. */
async function getValidAccessToken(organisationId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("connections")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("provider", "canva")
    .maybeSingle();

  if (!connection || connection.status !== "connected" || !connection.access_token_encrypted) {
    throw new Error("Canva isn't connected for this workspace yet. Connect it under Connections → Canva.");
  }

  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  const isExpiringSoon = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;

  if (!isExpiringSoon) {
    return connection.access_token_encrypted;
  }

  const config = getCanvaOAuthConfig();
  if (!config || !connection.refresh_token_encrypted) {
    throw new Error("Canva connection has expired and can't be refreshed automatically. Reconnect it under Connections.");
  }

  const refreshed = await refreshCanvaToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: connection.refresh_token_encrypted,
  });

  await admin
    .from("connections")
    .update({
      access_token_encrypted: refreshed.accessToken,
      refresh_token_encrypted: refreshed.refreshToken,
      expires_at: refreshed.expiresAt.toISOString(),
    })
    .eq("id", connection.id);

  return refreshed.accessToken;
}

export async function disconnectCanva(organisationId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("connections")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      expires_at: null,
    })
    .eq("organisation_id", organisationId)
    .eq("provider", "canva");
}

export async function openDesignInCanva(
  supabase: SupabaseClient<Database>,
  designId: string
): Promise<{ url: string }> {
  const { data: design, error: designError } = await supabase.from("designs").select("*").eq("id", designId).single();
  if (designError || !design) throw new Error("Design not found");
  if (!design.current_version_id) throw new Error("This design has no generated image yet");

  const { data: version, error: versionError } = await supabase
    .from("design_versions")
    .select("*")
    .eq("id", design.current_version_id)
    .single();
  if (versionError || !version?.generated_asset_id) throw new Error("Current version has no image to send to Canva");

  const { data: asset, error: assetError } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("id", version.generated_asset_id)
    .single();
  if (assetError || !asset?.storage_path) throw new Error("Generated image not found in storage");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("organisation_id")
    .eq("id", design.campaign_id)
    .single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const accessToken = await getValidAccessToken(campaign.organisation_id);

  const admin = createAdminClient();
  const { base64, mimeType } = await downloadAsBase64(admin, "generated-images", asset.storage_path);

  const canvaDesign = await provider.createDesignFromImage({
    accessToken,
    imageBytes: Buffer.from(base64, "base64"),
    mimeType,
    fileName: `${design.title.slice(0, 40)}.png`,
    title: design.title,
  });

  await supabase
    .from("designs")
    .update({
      canva_design_id: canvaDesign.designId,
      canva_edit_url: canvaDesign.editUrl,
      canva_sync_status: "synced",
      canva_last_synced_at: new Date().toISOString(),
    })
    .eq("id", design.id);

  const correlationState = buildCorrelationState(design.id);
  const url = new URL(canvaDesign.editUrl);
  url.searchParams.set("correlation_state", correlationState);

  return { url: url.toString() };
}

/**
 * Pulls the current state of a design's linked Canva design back in as a
 * new version (product spec §17 "Return / Sync"). The edit made in Canva
 * becomes a new `design_versions` row with `changed_by_ai: false` — a
 * human edited it — so version history correctly attributes it.
 */
export async function syncDesignFromCanva(
  supabase: SupabaseClient<Database>,
  params: { designId: string; userId: string }
): Promise<void> {
  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("*")
    .eq("id", params.designId)
    .single();
  if (designError || !design) throw new Error("Design not found");
  if (!design.canva_design_id) throw new Error("This design isn't linked to a Canva design yet");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("organisation_id")
    .eq("id", design.campaign_id)
    .single();
  if (campaignError || !campaign) throw new Error("Campaign not found");

  const { data: currentVersion } = design.current_version_id
    ? await supabase.from("design_versions").select("*").eq("id", design.current_version_id).single()
    : { data: null };

  await supabase.from("designs").update({ canva_sync_status: "syncing" }).eq("id", design.id);

  try {
    const accessToken = await getValidAccessToken(campaign.organisation_id);
    const exported = await provider.exportDesignAsPng({ accessToken, designId: design.canva_design_id });

    const imageResponse = await fetch(exported.url);
    if (!imageResponse.ok) throw new Error("Failed to download the exported design from Canva");
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const admin = createAdminClient();
    const { data: assetRow, error: assetError } = await supabase
      .from("generated_assets")
      .insert({
        organisation_id: campaign.organisation_id,
        campaign_id: design.campaign_id,
        design_version_id: null,
        provider: "canva",
        model: "canva-export",
        prompt: "Manual edit in Canva",
        mime_type: "image/png",
        width: 1024,
        height: 1024,
        status: "completed",
        parent_asset_id: currentVersion?.generated_asset_id ?? null,
      })
      .select()
      .single();
    if (assetError || !assetRow) throw new Error(assetError?.message ?? "Failed to record synced asset");

    const path = generatedImagePath(campaign.organisation_id, design.campaign_id, assetRow.id, "png");
    const { error: uploadError } = await admin.storage
      .from("generated-images")
      .upload(path, imageBuffer, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    await supabase.from("generated_assets").update({ storage_path: path }).eq("id", assetRow.id);

    const { data: lastVersion } = await supabase
      .from("design_versions")
      .select("version_number")
      .eq("design_id", design.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: newVersion, error: versionError } = await supabase
      .from("design_versions")
      .insert({
        design_id: design.id,
        version_number: (lastVersion?.version_number ?? 0) + 1,
        headline: currentVersion?.headline ?? design.title,
        supporting_copy: currentVersion?.supporting_copy ?? "",
        cta: currentVersion?.cta ?? "",
        generated_asset_id: assetRow.id,
        change_description: "Synced from a manual edit in Canva",
        changed_by_user_id: params.userId,
        changed_by_ai: false,
      })
      .select()
      .single();
    if (versionError || !newVersion) throw new Error(versionError?.message ?? "Failed to save synced version");

    await supabase.from("generated_assets").update({ design_version_id: newVersion.id }).eq("id", assetRow.id);

    await supabase
      .from("designs")
      .update({
        current_version_id: newVersion.id,
        status: "human_review",
        canva_sync_status: "synced",
        canva_last_synced_at: new Date().toISOString(),
      })
      .eq("id", design.id);
  } catch (error) {
    await supabase.from("designs").update({ canva_sync_status: "error" }).eq("id", design.id);
    throw error;
  }
}
