import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'demo', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  AI_SERVICE_URL: z.url().default('http://localhost:8000'),
  AI_SERVICE_INTERNAL_TOKEN: z.string().min(16).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid API environment: ${fields}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    throw new Error('Production mode is out of scope for this Devnet prototype.');
  }
  return parsed.data;
}

export function requireValue<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
