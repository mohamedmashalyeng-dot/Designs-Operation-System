import "server-only";
import type { ImageEvalProvider, ImageProvider, LLMProvider } from "./types";
import { isOpenAIConfigured } from "./providers/openai/client";
import { OpenAILLMProvider } from "./providers/openai/llm-provider";
import { OpenAIImageProvider } from "./providers/openai/image-provider";
import { OpenAIVisionProvider } from "./providers/openai/vision-provider";
import { MockLLMProvider } from "./providers/mock/llm-provider";
import { MockImageProvider } from "./providers/mock/image-provider";
import { MockVisionProvider } from "./providers/mock/vision-provider";

/**
 * Provider factory. This is the ONLY place that decides which concrete AI
 * provider backs each capability — everything else in the app depends on
 * the interfaces in `./types`, never on a provider class directly. Adding
 * a provider (e.g. a Google model) means: implement the interface in
 * `./providers/<name>/`, add one branch below, done.
 */

let llmProvider: LLMProvider | null = null;
let imageProvider: ImageProvider | null = null;
let imageEvalProvider: ImageEvalProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (llmProvider) return llmProvider;
  const configured = process.env.AI_LLM_PROVIDER ?? "openai";
  llmProvider = configured === "openai" && isOpenAIConfigured() ? new OpenAILLMProvider() : new MockLLMProvider();
  return llmProvider;
}

export function getImageProvider(): ImageProvider {
  if (imageProvider) return imageProvider;
  const configured = process.env.AI_IMAGE_PROVIDER ?? "openai";
  imageProvider = configured === "openai" && isOpenAIConfigured() ? new OpenAIImageProvider() : new MockImageProvider();
  return imageProvider;
}

export function getImageEvalProvider(): ImageEvalProvider {
  if (imageEvalProvider) return imageEvalProvider;
  const configured = process.env.AI_LLM_PROVIDER ?? "openai";
  imageEvalProvider =
    configured === "openai" && isOpenAIConfigured() ? new OpenAIVisionProvider() : new MockVisionProvider();
  return imageEvalProvider;
}

/** True when at least one capability is running against a live provider
 * rather than the mock — used to surface a "mock mode" badge in the UI. */
export function isUsingRealAIProvider(): boolean {
  return isOpenAIConfigured();
}

export * from "./types";
export * from "./schemas";
