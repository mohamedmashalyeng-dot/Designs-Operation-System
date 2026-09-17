import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

/** Lazily-constructed singleton so importing this module never throws when
 * the key is absent — callers check `isOpenAIConfigured()` and fall back
 * to the mock provider instead (see `src/lib/ai/index.ts`). */
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Default model ids. Verified against the live model list at
 * developers.openai.com/api/docs/models as of 2026-09 — re-check there
 * before changing, the lineup moves quickly. Override via env without a
 * code change if OpenAI ships a better default for this workload.
 */
export const DEFAULT_LLM_MODEL = process.env.OPENAI_LLM_MODEL || "gpt-5.6-terra";
export const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
/** 1536-dimension embeddings — matches the `vector(1536)` column on
 * knowledge_chunks (0011_brand_brain_knowledge.sql). Changing this model
 * requires a migration to resize that column and re-embedding everything. */
export const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
