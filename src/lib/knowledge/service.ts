import "server-only";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmbeddingProvider, isEmbeddingAvailable } from "@/lib/ai";
import { extractText } from "./extract";
import { chunkText } from "./chunk";

/**
 * Knowledge ingestion pipeline (product spec §19/§20): download the
 * uploaded file, extract text per its type, chunk it, embed each chunk
 * when a real embedding provider is configured, and mark the document
 * `ready` — or `failed` with a real reason, never a silently-succeeded
 * document with no usable content.
 */
export async function processDocument(supabase: SupabaseClient<Database>, documentId: string): Promise<void> {
  const { data: doc, error } = await supabase.from("knowledge_documents").select("*").eq("id", documentId).single();
  if (error || !doc) throw new Error("Document not found");
  if (!doc.storage_path) throw new Error("Document has no uploaded file to process");

  await supabase.from("knowledge_documents").update({ status: "processing", error_message: null }).eq("id", documentId);

  try {
    const admin = createAdminClient();
    const { data: fileData, error: downloadError } = await admin.storage.from("knowledge-documents").download(doc.storage_path);
    if (downloadError || !fileData) throw new Error(downloadError?.message ?? "Failed to download the file");

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const text = await extractText(buffer, doc.mime_type ?? "text/plain");
    if (!text.trim()) throw new Error("No extractable text was found in this document.");

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("Document produced no usable content chunks.");

    // Clear any prior chunks — covers retrying a failed document or
    // re-processing after a Drive sync detects a change (product spec §23).
    await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

    const provider = isEmbeddingAvailable() ? getEmbeddingProvider() : null;

    const rows: Database["public"]["Tables"]["knowledge_chunks"]["Insert"][] = [];
    for (let i = 0; i < chunks.length; i++) {
      const embeddingResult = provider ? await provider.embed(chunks[i]) : null;
      rows.push({
        document_id: documentId,
        organisation_id: doc.organisation_id,
        chunk_index: i,
        content: chunks[i],
        embedding: embeddingResult?.embedding ?? null,
        embedding_model: embeddingResult?.model ?? null,
      });
    }

    const { error: insertError } = await supabase.from("knowledge_chunks").insert(rows);
    if (insertError) throw new Error(insertError.message);

    await supabase.from("knowledge_documents").update({ status: "ready", content_hash: contentHash }).eq("id", documentId);
  } catch (err) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Unknown error" })
      .eq("id", documentId);
    throw err;
  }
}
