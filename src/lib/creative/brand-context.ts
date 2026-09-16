import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BrandContext } from "@/lib/ai/prompts";

/**
 * Loads the organisation's Brand Brain into the shape the AI Creative
 * Director prompts expect. Returns null when no brand has been configured
 * yet — the prompt builder degrades gracefully in that case rather than
 * requiring Brand Brain setup before a campaign can be created.
 *
 * MVP assumes one primary brand per organisation (the schema allows more;
 * this just takes the first). Revisit if/when multi-brand orgs ship.
 */
export async function getBrandContext(
  supabase: SupabaseClient<Database>,
  organisationId: string
): Promise<BrandContext | null> {
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, tone, voice_description")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!brand) return null;

  const [{ data: rules }, { data: audiences }] = await Promise.all([
    supabase
      .from("brand_rules")
      .select("rule_text")
      .eq("brand_id", brand.id)
      .eq("is_active", true),
    supabase
      .from("audiences")
      .select("name, description, preferred_messaging")
      .eq("brand_id", brand.id),
  ]);

  return {
    name: brand.name,
    tone: brand.tone ?? [],
    voiceDescription: brand.voice_description,
    rules: (rules ?? []).map((r) => r.rule_text),
    audiences: (audiences ?? []).map((a) => ({
      name: a.name,
      description: a.description,
      preferredMessaging: a.preferred_messaging,
    })),
  };
}
