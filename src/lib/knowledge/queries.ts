import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export async function getKnowledgeDocuments(supabase: SupabaseClient<Database>): Promise<Tables<"knowledge_documents">[]> {
  const { data } = await supabase.from("knowledge_documents").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
