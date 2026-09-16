import { z } from "zod";
import { AUDIENCE_TYPES, CAMPAIGN_OBJECTIVES, CHANNELS } from "@/lib/constants/enums";

export const createCampaignSchema = z.object({
  rawPrompt: z
    .string()
    .trim()
    .min(10, "Describe what you want to create in a bit more detail.")
    .max(2000, "Keep the description under 2000 characters."),
  objective: z.enum(CAMPAIGN_OBJECTIVES).default("other"),
  audienceType: z.enum(AUDIENCE_TYPES).default("custom"),
  channels: z.array(z.enum(CHANNELS)).default([]),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
