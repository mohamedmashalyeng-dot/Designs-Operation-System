import { z } from "zod";
import { CHANNELS } from "@/lib/constants/enums";

export const prepareCampaignSchema = z.object({
  masterDesignId: z.string().uuid(),
  channels: z.array(z.enum(CHANNELS)).min(1, "Pick at least one channel."),
});
