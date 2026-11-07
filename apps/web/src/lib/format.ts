import { formatBaseUnits, type ApplicationStatus } from '@reliefmesh/shared';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  needs_information: 'Needs information',
  under_review: 'Under review',
  approved: 'Approved by reviewer',
  funded: 'Funded on Devnet',
  delivery_submitted: 'Delivery evidence submitted',
  delivery_verified: 'Delivery confirmed by reviewer',
  completed: 'Completed — release confirmed',
  flagged: 'Flagged for follow-up',
  cancelled: 'Cancelled',
  expired: 'Expired',
  rejected: 'Not approved',
};

export const ROLE_LABELS: Record<string, string> = {
  field_worker: 'Field volunteer',
  ngo_reviewer: 'NGO reviewer',
  supplier: 'Supplier',
  donor: 'Donor',
  admin: 'Admin',
};

export function formatTokens(baseUnits: string | null, decimals: number): string {
  return baseUnits === null ? '—' : `${formatBaseUnits(baseUnits, decimals)} demo tokens`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  // Stored in UTC; shown in the viewer's local time (PRD §10).
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}
