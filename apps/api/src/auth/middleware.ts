import type { Request, RequestHandler } from 'express';
import type { AuthContext } from '../domain/types';
import { ApiError } from '../http/errors';
import type { Repository } from '../repositories/repository';

export interface TokenVerifier {
  /** Returns the authenticated user id, or null when the token is invalid or expired. */
  verify(accessToken: string): Promise<string | null>;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** Verifies the Supabase access token and loads memberships from the database (ADR-009). */
export function requireAuth(verifier: TokenVerifier, repo: Repository): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '');
    if (!match) throw new ApiError('UNAUTHENTICATED', 'Missing bearer access token.');
    const userId = await verifier.verify(match[1]!);
    if (!userId) throw new ApiError('UNAUTHENTICATED', 'Access token is invalid or expired.');
    req.auth = { userId, memberships: await repo.listMemberships(userId) };
    next();
  };
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new ApiError('UNAUTHENTICATED', 'Authentication required.');
  return req.auth;
}
