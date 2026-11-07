import { createClient } from '@supabase/supabase-js';
import { HttpAiClient } from './ai/aiClient';
import { createApp } from './app';
import { SupabaseTokenVerifier } from './auth/supabaseVerifier';
import { loadConfig, requireValue } from './config';
import { SupabaseRepository } from './repositories/supabaseRepository';

const config = loadConfig();

// Service-role client is server-only; every request is authorized by the API first (ADR-010).
const supabase = createClient(
  requireValue(config.SUPABASE_URL, 'SUPABASE_URL'),
  requireValue(config.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const app = createApp(config, {
  repo: new SupabaseRepository(supabase),
  verifier: new SupabaseTokenVerifier(supabase),
  ai: new HttpAiClient(
    config.AI_SERVICE_URL,
    requireValue(config.AI_SERVICE_INTERNAL_TOKEN, 'AI_SERVICE_INTERNAL_TOKEN'),
  ),
});

app.listen(config.PORT, () => {
  console.log(`ReliefMesh API listening on http://localhost:${config.PORT}/api/v1`);
});
