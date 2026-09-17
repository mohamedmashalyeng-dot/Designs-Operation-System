"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { processDocument } from "@/lib/knowledge/service";
import { searchKnowledge, type KnowledgeSearchResult } from "@/lib/knowledge/search";
import { knowledgeDocumentPath } from "@/lib/storage/paths";
import { documentIdSchema, knowledgeSearchSchema } from "@/lib/validation/knowledge";
import type { ActionResult } from "./campaigns";

async function currentOrganisationId(): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("organisation_members").select("organisation_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) throw new Error("No workspace found for your account.");
  return data.organisation_id;
}

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

export async function uploadKnowledgeDocumentAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = formData.get("title");
  const file = formData.get("file");

  if (typeof title !== "string" || !title.trim()) return { error: "Give the document a title." };
  if (!(file instanceof File)) return { error: "No file provided." };
  if (file.size > MAX_DOCUMENT_BYTES) return { error: "File is larger than 25MB." };
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) return { error: "Supported types: PDF, DOCX, TXT, Markdown." };

  const organisationId = await currentOrganisationId();
  const documentId = crypto.randomUUID();
  const path = knowledgeDocumentPath(organisationId, documentId, file.name);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("knowledge-documents").upload(path, bytes, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("knowledge_documents").insert({
    id: documentId,
    organisation_id: organisationId,
    title: title.trim(),
    source_type: "upload",
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    status: "uploaded",
    created_by: user.id,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/brand/knowledge");

  try {
    await processDocument(supabase, documentId);
  } catch (error) {
    console.error("Knowledge document processing failed:", error);
    // Non-fatal to the upload itself — the document is left in "failed"
    // status by processDocument, visible on the page with a Retry action.
  }

  revalidatePath("/brand/knowledge");
  return {};
}

export async function retryProcessingAction(input: unknown): Promise<ActionResult> {
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  try {
    await processDocument(supabase, parsed.data.documentId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Processing failed" };
  }
  revalidatePath("/brand/knowledge");
  return {};
}

export async function deleteKnowledgeDocumentAction(input: unknown): Promise<ActionResult> {
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();

  const { data: doc } = await supabase.from("knowledge_documents").select("storage_path").eq("id", parsed.data.documentId).single();
  if (doc?.storage_path) await supabase.storage.from("knowledge-documents").remove([doc.storage_path]);

  const { error } = await supabase.from("knowledge_documents").delete().eq("id", parsed.data.documentId);
  if (error) return { error: error.message };

  revalidatePath("/brand/knowledge");
  return {};
}

export async function searchKnowledgeAction(input: unknown): Promise<ActionResult & { results?: KnowledgeSearchResult[] }> {
  const parsed = knowledgeSearchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requireUser();
  const supabase = await createClient();
  const organisationId = await currentOrganisationId();

  const results = await searchKnowledge(supabase, { organisationId, query: parsed.data.query });
  return { results };
}
