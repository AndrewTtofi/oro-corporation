import { z } from "zod";

export const passwordPolicy = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

export const registerSchema = z.object({
  fullName: z.string().min(2, "Please enter your full legal name").max(120),
  email: z.string().email().toLowerCase(),
  phoneCountry: z.string().regex(/^\+\d{1,4}$/, "Country code looks wrong"),
  phoneNumber: z.string().regex(/^\d{4,15}$/, "Phone number digits only"),
  password: passwordPolicy,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const forgotSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetSchema = z.object({
  token: z.string().min(16),
  password: passwordPolicy,
});
