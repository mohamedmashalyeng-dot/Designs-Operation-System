/** Fixed-size character chunking with a small overlap so a fact split
 * across a chunk boundary is still findable from either side. Simple by
 * design — no semantic/sentence-aware splitting, which isn't worth the
 * complexity at this product's scale. */
export function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end === cleaned.length) break;
    start = end - overlap;
  }
  return chunks;
}
