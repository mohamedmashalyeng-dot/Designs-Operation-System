import { z } from "zod";

export const updateConceptSchema = z.object({
  conceptId: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  headline: z.string().trim().min(1).max(200),
  supportingCopy: z.string().trim().min(1).max(500),
  cta: z.string().trim().min(1).max(60),
  imagePrompt: z.string().trim().min(1).max(4000),
});

export type UpdateConceptInput = z.infer<typeof updateConceptSchema>;
