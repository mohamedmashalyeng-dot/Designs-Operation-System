import { z } from "zod";
import { CHANNELS } from "@/lib/constants/enums";

export const connectWordPressSchema = z.object({
  siteUrl: z.string().trim().min(4, "Enter your site's URL.").max(300),
  username: z.string().trim().min(1, "Enter your WordPress username."),
  applicationPassword: z.string().trim().min(1, "Enter the application password."),
});

export const publishNowSchema = z.object({
  designId: z.string().uuid(),
  channel: z.enum(CHANNELS),
});

export const scheduleSchema = z.object({
  designId: z.string().uuid(),
  channel: z.enum(CHANNELS),
  scheduledFor: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time."),
});

export const jobIdSchema = z.object({ jobId: z.string().uuid() });

export const rescheduleJobSchema = z.object({
  jobId: z.string().uuid(),
  scheduledFor: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time."),
});
