import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
  displayName: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(40, "Máximo 40 caracteres"),
  pin: z.string().trim().min(1, "Ingresa el código de invitación"),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const predictionSchema = z.object({
  matchId: z.number().int().positive(),
  homeScore: z.number().int().min(0).max(30),
  awayScore: z.number().int().min(0).max(30),
  winner: z.enum(["home", "away", "draw"]).optional().nullable(),
});

export type PredictionInput = z.infer<typeof predictionSchema>;
