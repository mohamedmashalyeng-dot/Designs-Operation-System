import { z } from "zod";
import { SOCIAL_FORMATS } from "@/lib/creative/formats";
import { LAYOUT_PRESETS } from "@/lib/creative/layouts";

const FORMAT_IDS = SOCIAL_FORMATS.map((f) => f.id) as [string, ...string[]];
const LAYOUT_IDS = LAYOUT_PRESETS.map((l) => l.id) as [string, ...string[]];

export const formatIdSchema = z.enum(FORMAT_IDS);
export const layoutIdSchema = z.enum(LAYOUT_IDS);

export const selectConceptSchema = z.object({
  campaignId: z.string().uuid(),
  conceptId: z.string().uuid(),
  formatId: formatIdSchema,
});

export const chooseVariationSchema = z.object({
  designId: z.string().uuid(),
  assetId: z.string().uuid(),
  headline: z.string().trim().min(1).max(200),
  supportingCopy: z.string().trim().min(1).max(500),
  cta: z.string().trim().min(1).max(60),
  layoutPreset: layoutIdSchema,
});

export const regenerateCreativeSchema = z.object({
  designId: z.string().uuid(),
  layoutPreset: layoutIdSchema.optional(),
});

export const adaptFormatSchema = z.object({
  sourceDesignId: z.string().uuid(),
  formatId: formatIdSchema,
});

export const editCopySchema = z.object({
  designId: z.string().uuid(),
  headline: z.string().trim().min(1).max(200),
  supportingCopy: z.string().trim().min(1).max(500),
  cta: z.string().trim().min(1).max(60),
  layoutPreset: layoutIdSchema,
});
