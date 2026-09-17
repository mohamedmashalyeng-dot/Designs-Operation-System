import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, Database } from "@/types/database";

/**
 * `connections.access_token_encrypted` / `refresh_token_encrypted` are
 * revoked from the `authenticated` Postgres role (0006_connections_and_
 * publishing.sql) — a plain `select('*')` against this table with the
 * user-scoped client fails outright (Postgres denies the whole query if
 * any referenced column is unauthorized). Always select this explicit
 * column list instead.
 */
const SAFE_COLUMNS =
  "id, organisation_id, provider, status, external_account_id, external_account_name, expires_at, metadata, created_at, updated_at";

export interface ConnectionSummary {
  id: string;
  status: Database["public"]["Tables"]["connections"]["Row"]["status"];
  externalAccountName: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export async function getConnection(
  supabase: SupabaseClient<Database>,
  provider: Database["public"]["Tables"]["connections"]["Row"]["provider"]
): Promise<ConnectionSummary | null> {
  const { data } = await supabase
    .from("connections")
    .select(SAFE_COLUMNS)
    .eq("provider", provider)
    .maybeSingle<{
      id: string;
      status: ConnectionSummary["status"];
      external_account_name: string | null;
      expires_at: string | null;
      updated_at: string;
    }>();

  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    externalAccountName: data.external_account_name,
    expiresAt: data.expires_at,
    updatedAt: data.updated_at,
  };
}

/** Which publishable channels currently have a connected integration —
 * backs the publish/schedule picker so it never offers a channel that
 * would just fail. "meta" covers both "facebook" and "instagram" (one
 * connection, the Page plus its linked Instagram account if any). */
export async function getConnectedChannels(supabase: SupabaseClient<Database>): Promise<Channel[]> {
  const { data } = await supabase.from("connections").select(SAFE_COLUMNS).eq("status", "connected");
  const providers = new Set((data ?? []).map((c) => c.provider));

  const channels: Channel[] = [];
  if (providers.has("linkedin")) channels.push("linkedin");
  if (providers.has("meta")) channels.push("facebook", "instagram");
  if (providers.has("website")) channels.push("website");
  return channels;
}
