import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  mobile: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceId: z.string().optional()
});

export const passwordResetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8)
});

export const emailTemplateSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  htmlContent: z.string(),
  textContent: z.string().optional()
});
