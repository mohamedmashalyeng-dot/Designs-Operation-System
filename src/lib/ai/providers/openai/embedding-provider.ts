import "server-only";
import type { EmbeddingProvider, EmbeddingResult } from "../../types";
import { AIProviderError } from "../../types";
import { getOpenAIClient, DEFAULT_EMBEDDING_MODEL } from "./client";
import { mapOpenAIError } from "./llm-provider";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai";

  async embed(text: string): Promise<EmbeddingResult> {
    const client = getOpenAIClient();
    try {
      const response = await client.embeddings.create({ model: DEFAULT_EMBEDDING_MODEL, input: text });
      const embedding = response.data[0]?.embedding;
      if (!embedding) throw new AIProviderError("Provider returned no embedding", this.id, "invalid_response");
      return { embedding, model: DEFAULT_EMBEDDING_MODEL };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw mapOpenAIError(error, this.id);
    }
  }
}
