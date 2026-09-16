"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { upsertBrandSchema, brandRuleSchema, audienceSchema, productSchema } from "@/lib/validation/brand";
import { brandAssetPath } from "@/lib/storage/paths";
import { BRAND_ASSET_TYPES } from "@/lib/constants/enums";
import type { ActionResult } from "./campaigns";

async function getOrganisationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", userId).limit(1).maybeSingle();
  if (!data) throw new Error("No workspace found");
  return data.organisation_id;
}

export async function upsertBrandAction(input: unknown): Promise<ActionResult> {
  const parsed = upsertBrandSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const user = await requireUser();
  const supabase = await createClient();
  const organisationId = await getOrganisationId(supabase, user.id);

  const payload = {
    organisation_id: organisationId,
    name: parsed.data.name,
    voice_description: parsed.data.voiceDescription || null,
    tone: parsed.data.tone,
    colours: parsed.data.colours,
    fonts: parsed.data.fonts,
  };

  const { error } = parsed.data.brandId
    ? await supabase.from("brands").update(payload).eq("id", parsed.data.brandId)
    : await supabase.from("brands").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/brand");
  return {};
}

export async function addBrandRuleAction(input: unknown): Promise<ActionResult> {
  const parsed = brandRuleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("brand_rules").insert({ brand_id: parsed.data.brandId, rule_text: parsed.data.ruleText });
  if (error) return { error: error.message };
  revalidatePath("/brand/rules");
  return {};
}

export async function toggleBrandRuleAction(ruleId: string, isActive: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("brand_rules").update({ is_active: isActive }).eq("id", ruleId);
  if (error) return { error: error.message };
  revalidatePath("/brand/rules");
  return {};
}

export async function deleteBrandRuleAction(ruleId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("brand_rules").delete().eq("id", ruleId);
  if (error) return { error: error.message };
  revalidatePath("/brand/rules");
  return {};
}

export async function upsertAudienceAction(input: unknown): Promise<ActionResult> {
  const parsed = audienceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await requireUser();
  const supabase = await createClient();

  const payload = {
    brand_id: parsed.data.brandId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    market: parsed.data.market || null,
    problems: parsed.data.problems,
    motivations: parsed.data.motivations,
    preferred_messaging: parsed.data.preferredMessaging || null,
  };

  const { error } = parsed.data.audienceId
    ? await supabase.from("audiences").update(payload).eq("id", parsed.data.audienceId)
    : await supabase.from("audiences").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/brand/audiences");
  return {};
}

export async function deleteAudienceAction(audienceId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("audiences").delete().eq("id", audienceId);
  if (error) return { error: error.message };
  revalidatePath("/brand/audiences");
  return {};
}

export async function upsertProductAction(input: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await requireUser();
  const supabase = await createClient();

  const payload = {
    brand_id: parsed.data.brandId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    benefits: parsed.data.benefits,
    cta: parsed.data.cta || null,
    audience_id: parsed.data.audienceId || null,
  };

  const { error } = parsed.data.productId
    ? await supabase.from("products").update(payload).eq("id", parsed.data.productId)
    : await supabase.from("products").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/brand/courses");
  return {};
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { error: error.message };
  revalidatePath("/brand/courses");
  return {};
}

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp", "application/pdf"]);

export async function uploadBrandAssetAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const brandId = formData.get("brandId");
  const type = formData.get("type");
  const file = formData.get("file");

  if (typeof brandId !== "string" || !brandId) return { error: "Missing brand" };
  if (typeof type !== "string" || !BRAND_ASSET_TYPES.includes(type as (typeof BRAND_ASSET_TYPES)[number])) {
    return { error: "Invalid asset type" };
  }
  if (!(file instanceof File)) return { error: "No file provided" };
  if (file.size > MAX_ASSET_BYTES) return { error: "File is larger than 25MB" };
  if (!ALLOWED_ASSET_TYPES.has(file.type)) return { error: "Unsupported file type" };

  const organisationId = await getOrganisationId(supabase, user.id);
  const assetId = crypto.randomUUID();
  const path = brandAssetPath(organisationId, brandId, assetId, file.name);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("brand-assets").upload(path, bytes, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("brand_assets").insert({
    id: assetId,
    brand_id: brandId,
    type: type as (typeof BRAND_ASSET_TYPES)[number],
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/brand/assets");
  return {};
}

export async function deleteBrandAssetAction(assetId: string, storagePath: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  await supabase.storage.from("brand-assets").remove([storagePath]);
  const { error } = await supabase.from("brand_assets").delete().eq("id", assetId);
  if (error) return { error: error.message };
  revalidatePath("/brand/assets");
  return {};
}
