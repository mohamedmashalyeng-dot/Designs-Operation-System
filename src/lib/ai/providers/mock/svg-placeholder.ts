/** Deterministic, dependency-free placeholder image for the mock provider —
 * no canvas/image library required, and it renders fine in a plain <img>. */
export function buildPlaceholderSvg(params: {
  prompt: string;
  width: number;
  height: number;
  label?: string;
}): string {
  const { prompt, width, height, label = "MOCK PREVIEW" } = params;
  const words = prompt.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 42) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length >= 3) break;
  }
  if (current && lines.length < 3) lines.push(current);
  if (lines.length === 3) lines[2] = lines[2].length > 39 ? `${lines[2].slice(0, 39)}…` : `${lines[2]}…`;

  const cx = width / 2;
  const textStartY = height / 2 - ((lines.length - 1) * 14);
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#EEF0F4"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#D8DBE2" stroke-width="1"/>
  <g stroke="#D8DBE2" stroke-width="1">
    <line x1="0" y1="0" x2="${width}" y2="${height}"/>
    <line x1="${width}" y1="0" x2="0" y2="${height}"/>
  </g>
  <circle cx="${cx}" cy="${height / 2 - 60}" r="28" fill="none" stroke="#9AA1AF" stroke-width="2"/>
  <path d="M ${cx - 12} ${height / 2 - 66} l 8 10 l 6 -6 l 12 14" fill="none" stroke="#9AA1AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  ${lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${textStartY + i * 28}" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" fill="#5A6070">${escape(line)}</text>`
    )
    .join("\n  ")}
  <g>
    <rect x="16" y="16" rx="6" ry="6" width="${label.length * 7.5 + 20}" height="26" fill="#3730A3"/>
    <text x="${16 + (label.length * 7.5 + 20) / 2}" y="33" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="600" letter-spacing="0.5" fill="#EEF0F4">${escape(label)}</text>
  </g>
</svg>`;
}
