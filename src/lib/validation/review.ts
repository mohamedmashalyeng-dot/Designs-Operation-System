import { z } from "zod";
import { REJECTION_REASONS } from "@/lib/constants/enums";

export const rejectDesignSchema = z.object({
  designId: z.string().uuid(),
  reasons: z.array(z.enum(REJECTION_REASONS)).min(1, "Select at least one reason."),
  comment: z.string().trim().max(2000).optional(),
});

export const aiEditSchema = z.object({
  designId: z.string().uuid(),
  feedback: z.string().trim().min(3, "Describe what you'd like changed.").max(1000),
});

export const feedbackCommentSchema = z.object({
  designId: z.string().uuid(),
  comment: z.string().trim().min(1).max(2000),
});
