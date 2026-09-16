import type { ZodType } from "zod";

/**
 * Provider-agnostic AI abstraction layer.
 *
 * Nothing outside `src/lib/ai/**` should import an SDK like `openai`
 * directly — application code (API routes, services) talks only to these
 * interfaces, resolved through `getLLMProvider()` / `getImageProvider()` /
 * `getImageEvalProvider()` in `src/lib/ai/index.ts`. That's what lets a
 * second provider (e.g. a Google model) be added later as one new file
 * plus one line in the factory, with zero changes to callers.
 */

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code:
      | "not_configured"
      | "rate_limited"
      | "content_rejected"
      | "invalid_response"
      | "upstream_error" = "upstream_error",
    public readonly retryable: boolean = false,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "AIProviderError";
  }
}

// ── LLM / Creative Director ────────────────────────────────────────────

export interface StructuredGenerationInput<T> {
  /** Model-visible name for the output schema (snake_case, no spaces). */
  schemaName: string;
  schema: ZodType<T>;
  /** System/developer instructions — the "role" and rules for the model. */
  instructions: string;
  /** The user-facing prompt / task content. */
  prompt: string;
}

export interface StructuredGenerationResult<T> {
  data: T;
  model: string;
  provider: string;
}

export interface LLMProvider {
  readonly id: string;
  generateStructured<T>(
    input: StructuredGenerationInput<T>
  ): Promise<StructuredGenerationResult<T>>;
}

// ── Image Generation & Editing ─────────────────────────────────────────

export interface GenerateImageInput {
  prompt: string;
  width: number;
  height: number;
  n?: number;
}

export interface EditImageInput {
  prompt: string;
  /** Source image bytes to edit, base64-encoded (no data: prefix). */
  sourceImageBase64: string;
  sourceMimeType: string;
  /** Optional mask; transparent areas mark what should change. */
  maskBase64?: string;
  width: number;
  height: number;
}

export interface GeneratedImage {
  /** Raw image bytes, base64-encoded (no data: prefix). */
  base64: string;
  mimeType: string;
}

export interface GeneratedImageResult {
  images: GeneratedImage[];
  model: string;
  provider: string;
  /** Non-fatal notes surfaced to the reviewer, e.g. a revised prompt. */
  notes?: string;
}

export interface ImageProvider {
  readonly id: string;
  generate(input: GenerateImageInput): Promise<GeneratedImageResult>;
  edit(input: EditImageInput): Promise<GeneratedImageResult>;
}

// ── Image Evaluation / Vision ───────────────────────────────────────────

export interface ImageEvaluationInput<T> {
  schemaName: string;
  schema: ZodType<T>;
  instructions: string;
  prompt: string;
  /** Image to evaluate, as a data: URL or a publicly-fetchable URL. */
  imageUrl: string;
}

export interface ImageEvalProvider {
  readonly id: string;
  evaluate<T>(
    input: ImageEvaluationInput<T>
  ): Promise<StructuredGenerationResult<T>>;
}
