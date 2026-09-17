import "server-only";

/**
 * Text extraction per document type (product spec §19). Both libraries are
 * imported dynamically inside the function rather than at module top level
 * — neither needs to be pulled into every server bundle that merely
 * imports this file, and pdf-parse in particular does its own lazy
 * PDF.js worker setup that's better deferred to when it's actually used.
 *
 * pdf-parse v2 API (verified against the installed package's own bundled
 * types — v1's `pdf(buffer)` function-call shape no longer exists):
 * `new PDFParse({ data }).getText()` → `{ text }`.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported document type: ${mimeType}`);
}
