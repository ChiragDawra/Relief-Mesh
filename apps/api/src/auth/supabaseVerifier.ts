import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../http/errors';
import type { TokenVerifier } from './middleware';

export class SupabaseTokenVerifier implements TokenVerifier {
  constructor(private readonly db: SupabaseClient) {}

  async verify(accessToken: string): Promise<string | null> {
    const { data, error } = await this.db.auth.getUser(accessToken);
    if (error) {
      // No status (network failure) or 5xx means Auth is down, not that the token is bad.
      if (!error.status || error.status >= 500) {
        throw new ApiError('SERVICE_UNAVAILABLE', 'Authentication service is unavailable.');
      }
      return null;
    }
    return data.user?.id ?? null;
  }
}
