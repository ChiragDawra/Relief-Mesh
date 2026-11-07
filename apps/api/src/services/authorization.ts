import type { Role } from '@reliefmesh/shared';
import type { AuthContext, Membership } from '../domain/types';
import { ApiError } from '../http/errors';

export const STAFF_ROLES = ['field_worker', 'ngo_reviewer', 'admin'] as const satisfies readonly Role[];
export const INTAKE_ROLES = ['field_worker', 'admin'] as const satisfies readonly Role[];
export const REVIEW_ROLES = ['ngo_reviewer', 'admin'] as const satisfies readonly Role[];

export function findOrgMembership(
  auth: AuthContext,
  organizationId: string | null,
  roles: readonly Role[],
): Membership | undefined {
  if (!organizationId) return undefined;
  return auth.memberships.find((m) => m.organization_id === organizationId && roles.includes(m.role));
}

export function requireOrgRole(
  auth: AuthContext,
  organizationId: string,
  roles: readonly Role[],
  message: string,
): Membership {
  const membership = findOrgMembership(auth, organizationId, roles);
  if (!membership) throw new ApiError('FORBIDDEN', message);
  return membership;
}

export function orgIdsWithRole(auth: AuthContext, roles: readonly Role[]): string[] {
  return [...new Set(auth.memberships.filter((m) => roles.includes(m.role)).map((m) => m.organization_id))];
}

export function hasAnyRole(auth: AuthContext, roles: readonly Role[]): boolean {
  return auth.memberships.some((m) => roles.includes(m.role));
}
