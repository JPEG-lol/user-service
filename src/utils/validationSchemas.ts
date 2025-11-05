import { z } from 'zod';

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters long');

export const registerSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email format'),
  passwordhash: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).strict("Only 'username' and 'email' can be updated here.");

export const updateUserPasswordSchema = z.object({
  newPassword: passwordSchema,
});