import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getEmbeddingProvider, isEmbeddingAvailable } from "@/lib/ai";

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  /** Cosine similarity (0-1) when vector search ran; null when this result
   * came from the full-text fallback instead. */
  similarity: number | null;
}

/**
 * Hybrid retrieval (product spec §17/§25): vector similarity when a real
 * embedding provider is configured, Postgres full-text search always —
 * search never silently returns nothing just because embeddings aren't
 * set up, and never pretends a full-text match is a semantic one.
 */
export async function searchKnowledge(
  supabase: SupabaseClient<Database>,
  params: { organisationId: string; query: string; limit?: number }
): Promise<KnowledgeSearchResult[]> {
  const limit = params.limit ?? 5;
  const trimmed = params.query.trim();
  if (!trimmed) return [];

  if (isEmbeddingAvailable()) {
    try {
      const { embedding } = await getEmbeddingProvider().embed(trimmed);
      const { data, error } = await supabase.rpc("match_knowledge_chunks", {
        query_embedding: embedding,
        match_org: params.organisationId,
        match_count: limit,
      });
      if (!error && data && data.length > 0) {
        const titles = await getDocumentTitles(supabase, data.map((d) => d.document_id));
        return data.map((row) => ({
          chunkId: row.id,
          documentId: row.document_id,
          documentTitle: titles.get(row.document_id) ?? "Untitled document",
          content: row.content,
          similarity: row.similarity,
        }));
      }
    } catch (error) {
      console.error("Vector search failed, falling back to full-text:", error);
    }
  }

  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, document_id, content")
    .eq("organisation_id", params.organisationId)
    .textSearch("search_vector", trimmed, { type: "websearch" })
    .limit(limit);

  if (!data || data.length === 0) return [];
  const titles = await getDocumentTitles(supabase, data.map((d) => d.document_id));
  return data.map((row) => ({
    chunkId: row.id,
    documentId: row.document_id,
    documentTitle: titles.get(row.document_id) ?? "Untitled document",
    content: row.content,
    similarity: null,
  }));
}

async function getDocumentTitles(supabase: SupabaseClient<Database>, documentIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(documentIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("knowledge_documents").select("id, title").in("id", ids);
  return new Map((data ?? []).map((d) => [d.id, d.title]));
}
