import type { EditImageInput, GenerateImageInput, GeneratedImageResult, ImageProvider } from "../../types";
import { buildPlaceholderSvg } from "./svg-placeholder";
import { sleep } from "./sleep";

/**
 * MOCK PROVIDER — used automatically when OPENAI_API_KEY is not set, so
 * the full generation → review → approval workflow is testable without
 * live credentials. Produces a clearly-labeled placeholder, never a fake
 * "real" image — see the "MOCK PREVIEW" badge baked into the SVG.
 */
export class MockImageProvider implements ImageProvider {
  readonly id = "mock";

  async generate(input: GenerateImageInput): Promise<GeneratedImageResult> {
    await sleep(1200);
    const svg = buildPlaceholderSvg({ prompt: input.prompt, width: input.width, height: input.height });
    return {
      provider: this.id,
      model: "mock-image-provider",
      images: Array.from({ length: input.n ?? 1 }, () => ({
        base64: Buffer.from(svg, "utf-8").toString("base64"),
        mimeType: "image/svg+xml",
      })),
    };
  }

  async edit(input: EditImageInput): Promise<GeneratedImageResult> {
    await sleep(1200);
    const svg = buildPlaceholderSvg({
      prompt: `Edited: ${input.prompt}`,
      width: input.width,
      height: input.height,
    });
    return {
      provider: this.id,
      model: "mock-image-provider",
      images: [{ base64: Buffer.from(svg, "utf-8").toString("base64"), mimeType: "image/svg+xml" }],
    };
  }
}
