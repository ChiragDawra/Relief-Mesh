import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

let client: SupabaseClient | undefined;

/** Browser client is used for sign-in only; application data goes through the API (ADR-010). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  }
  return client;
}
