import { z } from 'zod';

// Public values only (ADR-008). Server secrets never use the VITE_ prefix.
const envSchema = z.object({
  VITE_API_BASE_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
});

export const envResult = envSchema.safeParse(import.meta.env);

export function getEnv() {
  if (!envResult.success) throw new Error('Web environment is not configured.');
  return envResult.data;
}
