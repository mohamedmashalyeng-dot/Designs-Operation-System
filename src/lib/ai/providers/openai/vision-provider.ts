import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import type { ImageEvalProvider, ImageEvaluationInput, StructuredGenerationResult } from "../../types";
import { AIProviderError } from "../../types";
import { getOpenAIClient, DEFAULT_LLM_MODEL } from "./client";
import { mapOpenAIError } from "./llm-provider";

export class OpenAIVisionProvider implements ImageEvalProvider {
  readonly id = "openai";

  async evaluate<T>(input: ImageEvaluationInput<T>): Promise<StructuredGenerationResult<T>> {
    const client = getOpenAIClient();

    try {
      const response = await client.responses.parse({
        model: DEFAULT_LLM_MODEL,
        instructions: input.instructions,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: input.prompt },
              { type: "input_image", image_url: input.imageUrl, detail: "high" },
            ],
          },
        ],
        text: { format: zodTextFormat(input.schema, input.schemaName) },
      });

      if (response.output_parsed === null || response.output_parsed === undefined) {
        throw new AIProviderError("Model returned no parseable output", this.id, "invalid_response");
      }

      return { data: response.output_parsed, model: DEFAULT_LLM_MODEL, provider: this.id };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw mapOpenAIError(error, this.id);
    }
  }
}
