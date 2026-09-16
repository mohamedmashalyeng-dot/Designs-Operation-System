import { z } from "zod";

const colourSchema = z.object({ name: z.string().trim().min(1).max(40), hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour") });
const fontSchema = z.object({ role: z.string().trim().min(1).max(40), family: z.string().trim().min(1).max(80) });

export const upsertBrandSchema = z.object({
  brandId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Brand name is required").max(120),
  voiceDescription: z.string().trim().max(1000).optional(),
  tone: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  colours: z.array(colourSchema).max(12).default([]),
  fonts: z.array(fontSchema).max(6).default([]),
});

export const brandRuleSchema = z.object({
  brandId: z.string().uuid(),
  ruleText: z.string().trim().min(1, "Enter a rule").max(500),
});

export const audienceSchema = z.object({
  brandId: z.string().uuid(),
  audienceId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  market: z.string().trim().max(120).optional(),
  problems: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  motivations: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  preferredMessaging: z.string().trim().max(500).optional(),
});

export const productSchema = z.object({
  brandId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(1000).optional(),
  benefits: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  cta: z.string().trim().max(60).optional(),
  audienceId: z.string().uuid().optional(),
});
