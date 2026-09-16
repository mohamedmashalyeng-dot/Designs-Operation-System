import "server-only";
import { toFile } from "openai";
import type { ImagesResponse } from "openai/resources/images";
import type { EditImageInput, GenerateImageInput, GeneratedImageResult, ImageProvider } from "../../types";
import { AIProviderError } from "../../types";
import { getOpenAIClient, DEFAULT_IMAGE_MODEL } from "./client";
import { mapOpenAIError } from "./llm-provider";

const DEFAULT_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "high") as
  | "low"
  | "medium"
  | "high";

/** GPT image models generate at a fixed set of standard sizes; snap the
 * requested aspect ratio to the closest one rather than failing on an
 * unsupported WIDTHxHEIGHT. */
function resolveSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ratio = width / height;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

function toResult(response: ImagesResponse, provider: string): GeneratedImageResult {
  if (!response.data || response.data.length === 0) {
    throw new AIProviderError("Provider returned no images", provider, "invalid_response");
  }
  const mimeType = `image/${response.output_format ?? "png"}`;
  return {
    provider,
    model: DEFAULT_IMAGE_MODEL,
    notes: response.data[0]?.revised_prompt,
    images: response.data.map((img) => {
      if (!img.b64_json) {
        throw new AIProviderError("Provider returned an image without base64 data", provider, "invalid_response");
      }
      return { base64: img.b64_json, mimeType };
    }),
  };
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = "openai";

  async generate(input: GenerateImageInput): Promise<GeneratedImageResult> {
    const client = getOpenAIClient();
    try {
      const response = await client.images.generate({
        model: DEFAULT_IMAGE_MODEL,
        prompt: input.prompt,
        size: resolveSize(input.width, input.height),
        n: input.n ?? 1,
        quality: DEFAULT_QUALITY,
        output_format: "png",
      });
      return toResult(response, this.id);
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw mapOpenAIError(error, this.id);
    }
  }

  async edit(input: EditImageInput): Promise<GeneratedImageResult> {
    const client = getOpenAIClient();
    try {
      const image = await toFile(
        Buffer.from(input.sourceImageBase64, "base64"),
        "source.png",
        { type: input.sourceMimeType }
      );
      const mask = input.maskBase64
        ? await toFile(Buffer.from(input.maskBase64, "base64"), "mask.png", { type: "image/png" })
        : undefined;

      const response = await client.images.edit({
        model: DEFAULT_IMAGE_MODEL,
        image,
        ...(mask ? { mask } : {}),
        prompt: input.prompt,
        size: resolveSize(input.width, input.height),
        output_format: "png",
      });
      return toResult(response, this.id);
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw mapOpenAIError(error, this.id);
    }
  }
}
