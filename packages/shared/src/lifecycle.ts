import type { ApplicationStatus } from './enums';

/**
 * Allowed application-status transitions (PRD §8 + ADR-011).
 * Mirrored by public.case_transition_allowed() in supabase/migrations/0002_workflow.sql;
 * test/lifecycle.test.ts fails if the two drift apart.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  submitted: ['needs_information', 'under_review', 'flagged'],
  needs_information: ['submitted', 'under_review', 'flagged'],
  under_review: ['approved', 'needs_information', 'flagged', 'rejected'],
  approved: ['funded', 'cancelled'],
  funded: ['delivery_submitted', 'expired'],
  delivery_submitted: ['delivery_verified', 'funded'],
  delivery_verified: ['completed'],
  completed: [],
  flagged: [],
  cancelled: [],
  expired: [],
  rejected: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuses a volunteer may still edit. */
export const EDITABLE_STATUSES: readonly ApplicationStatus[] = ['submitted', 'needs_information'];

/** Statuses whose public-safe summary may be shown to donors and the public receipt page. */
export const PUBLIC_STATUSES: readonly ApplicationStatus[] = [
  'approved',
  'funded',
  'delivery_submitted',
  'delivery_verified',
  'completed',
  'expired',
];
