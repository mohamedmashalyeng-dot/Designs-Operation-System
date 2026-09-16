import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(100),
  organisationName: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
