import type { ImageEvalProvider, ImageEvaluationInput, StructuredGenerationResult } from "../../types";
import { AIProviderError } from "../../types";
import { SCHEMA_NAMES } from "../../schemas";
import { sleep } from "./sleep";

export class MockVisionProvider implements ImageEvalProvider {
  readonly id = "mock";

  async evaluate<T>(input: ImageEvaluationInput<T>): Promise<StructuredGenerationResult<T>> {
    await sleep(1000);

    if (input.schemaName !== SCHEMA_NAMES.imageReview) {
      throw new AIProviderError(
        `Mock provider has no fixture for schema "${input.schemaName}". Set OPENAI_API_KEY to use the real provider.`,
        this.id,
        "invalid_response"
      );
    }

    const raw = {
      overallScore: 84,
      passesBrandGuidelines: true,
      issues: [],
      suggestions: ["This is a mock review — connect OPENAI_API_KEY for a real brand/quality assessment."],
      recommendation: "needs_human_review" as const,
    };

    const parsed = input.schema.safeParse(raw);
    if (!parsed.success) {
      throw new AIProviderError(`Mock image-review fixture no longer matches its schema`, this.id, "invalid_response");
    }

    return { data: parsed.data, model: "mock-vision-reviewer", provider: this.id };
  }
}
