import { z } from "zod";

export const knowledgeSearchSchema = z.object({
  query: z.string().trim().min(1, "Enter something to search for.").max(200),
});

export const documentIdSchema = z.object({ documentId: z.string().uuid() });
