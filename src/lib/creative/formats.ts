/**
 * Central social-format configuration (product spec §8) — every place that
 * needs platform dimensions reads this instead of hardcoding numbers.
 * Deliberately app-level config, not a DB table, matching how
 * `campaigns.channels` already works: adding a format is a code change,
 * not a migration.
 */

import type { Channel } from "@/types/database";

export type FormatCategory = "square" | "portrait" | "landscape" | "story";

export interface SocialFormat {
  id: string;
  platform: string;
  /** Which publishing channel this format belongs to — derived once here
   * rather than re-inferred from `platform` strings everywhere else. */
  channel: Channel;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  category: FormatCategory;
}

export const SOCIAL_FORMATS: SocialFormat[] = [
  { id: "instagram_square", platform: "Instagram", channel: "instagram", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1", category: "square" },
  { id: "instagram_portrait", platform: "Instagram", channel: "instagram", label: "Portrait", width: 1080, height: 1350, aspectRatio: "4:5", category: "portrait" },
  { id: "instagram_story", platform: "Instagram", channel: "instagram", label: "Story", width: 1080, height: 1920, aspectRatio: "9:16", category: "story" },
  { id: "instagram_reel_cover", platform: "Instagram", channel: "instagram", label: "Reel Cover", width: 1080, height: 1920, aspectRatio: "9:16", category: "story" },
  { id: "facebook_feed", platform: "Facebook", channel: "facebook", label: "Feed", width: 1200, height: 630, aspectRatio: "1.91:1", category: "landscape" },
  { id: "facebook_square", platform: "Facebook", channel: "facebook", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1", category: "square" },
  { id: "linkedin_landscape", platform: "LinkedIn", channel: "linkedin", label: "Landscape", width: 1200, height: 627, aspectRatio: "1.91:1", category: "landscape" },
  { id: "linkedin_square", platform: "LinkedIn", channel: "linkedin", label: "Square", width: 1080, height: 1080, aspectRatio: "1:1", category: "square" },
  { id: "website_hero", platform: "Website", channel: "website", label: "Hero", width: 1920, height: 900, aspectRatio: "2.13:1", category: "landscape" },
];

const FORMAT_BY_ID = new Map(SOCIAL_FORMATS.map((f) => [f.id, f]));

export function getFormat(formatId: string): SocialFormat {
  return FORMAT_BY_ID.get(formatId) ?? SOCIAL_FORMATS[6]; // linkedin_landscape default
}

/** The best-fit default format for a channel — used when preparing a
 * channel adaptation without the user picking a specific ratio. */
export function defaultFormatForChannel(channel: Channel): SocialFormat {
  return SOCIAL_FORMATS.find((f) => f.channel === channel) ?? SOCIAL_FORMATS[6];
}

/** Orientation bucket used to pick a sensible image-generation size —
 * providers snap to a handful of supported shapes, so the exact target
 * crop is always finished by CreativeRenderer, not the raw generated image. */
export function orientationForFormat(format: SocialFormat): "landscape" | "portrait" | "square" {
  const ratio = format.width / format.height;
  if (ratio > 1.15) return "landscape";
  if (ratio < 0.87) return "portrait";
  return "square";
}
