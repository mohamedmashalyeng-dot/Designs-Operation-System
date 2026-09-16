import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import type { LLMProvider, StructuredGenerationInput, StructuredGenerationResult } from "../../types";
import { AIProviderError } from "../../types";
import { getOpenAIClient, DEFAULT_LLM_MODEL } from "./client";

export class OpenAILLMProvider implements LLMProvider {
  readonly id = "openai";

  async generateStructured<T>(
    input: StructuredGenerationInput<T>
  ): Promise<StructuredGenerationResult<T>> {
    const client = getOpenAIClient();

    try {
      const response = await client.responses.parse({
        model: DEFAULT_LLM_MODEL,
        instructions: input.instructions,
        input: input.prompt,
        text: { format: zodTextFormat(input.schema, input.schemaName) },
      });

      if (response.output_parsed === null || response.output_parsed === undefined) {
        throw new AIProviderError(
          "Model returned no parseable output",
          this.id,
          "invalid_response"
        );
      }

      return { data: response.output_parsed, model: DEFAULT_LLM_MODEL, provider: this.id };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw mapOpenAIError(error, this.id);
    }
  }
}

export function mapOpenAIError(error: unknown, provider: string): AIProviderError {
  const err = error as { status?: number; message?: string };
  if (err?.status === 429) {
    return new AIProviderError("Rate limited by provider", provider, "rate_limited", true, { cause: error });
  }
  if (err?.status === 400 && /moderation|safety|content/i.test(err.message ?? "")) {
    return new AIProviderError(
      "Content was rejected by the provider's safety system",
      provider,
      "content_rejected",
      false,
      { cause: error }
    );
  }
  if (typeof err?.status === "number" && err.status >= 500) {
    return new AIProviderError("Provider is currently unavailable", provider, "upstream_error", true, {
      cause: error,
    });
  }
  return new AIProviderError(
    err?.message || "Unexpected error calling AI provider",
    provider,
    "upstream_error",
    false,
    { cause: error }
  );
}
