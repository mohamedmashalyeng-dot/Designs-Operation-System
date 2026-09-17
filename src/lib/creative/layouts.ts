/**
 * Curated layout presets (product spec §12) — a small, deliberately
 * non-exhaustive set. Each preset tells CreativeRenderer how to composite
 * headline/copy/CTA/logo over the AI-generated image, and tells the Visual
 * Director which side of the frame to keep clear for typography (product
 * spec §28) — the two must stay in sync, which is why both read this file
 * rather than duplicating the mapping.
 */

export type TextAlignment = "left" | "right" | "center";
export type OverlayStyle = "gradient-bottom" | "solid-panel";
export type SubjectSide = "left" | "right" | "center" | "full-bleed";

export interface LayoutPreset {
  id: string;
  label: string;
  textAlignment: TextAlignment;
  overlayStyle: OverlayStyle;
  /** Which side of the frame the photographic subject should occupy — the
   * opposite side is left as negative space for the text panel. */
  subjectSide: SubjectSide;
  /** Human-readable composition instruction fed to the Visual Director. */
  compositionNote: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "bottom_message",
    label: "Bottom Message",
    textAlignment: "left",
    overlayStyle: "gradient-bottom",
    subjectSide: "full-bleed",
    compositionNote: "Full-bleed photograph with a dark gradient rising from the bottom third for legible overlaid text.",
  },
  {
    id: "top_headline",
    label: "Top Headline",
    textAlignment: "left",
    overlayStyle: "gradient-bottom",
    subjectSide: "full-bleed",
    compositionNote: "Full-bleed photograph with a dark gradient at the top third for a headline banner.",
  },
  {
    id: "text_left",
    label: "Text Left / Subject Right",
    textAlignment: "left",
    overlayStyle: "solid-panel",
    subjectSide: "right",
    compositionNote: "Subject positioned in the right two-thirds of the frame, clean negative space on the left third for a solid text panel.",
  },
  {
    id: "text_right",
    label: "Subject Left / Text Right",
    textAlignment: "right",
    overlayStyle: "solid-panel",
    subjectSide: "left",
    compositionNote: "Subject positioned in the left two-thirds of the frame, clean negative space on the right third for a solid text panel.",
  },
];

const LAYOUT_BY_ID = new Map(LAYOUT_PRESETS.map((l) => [l.id, l]));

export function getLayoutPreset(layoutId: string): LayoutPreset {
  return LAYOUT_BY_ID.get(layoutId) ?? LAYOUT_PRESETS[0];
}

/** Auto-picks a sensible default layout for a format's orientation — the
 * user can always switch it afterwards. Story/portrait formats read best
 * with a bottom message band; landscape formats have room for a side panel. */
export function defaultLayoutForOrientation(orientation: "landscape" | "portrait" | "square"): string {
  return orientation === "landscape" ? "text_left" : "bottom_message";
}
