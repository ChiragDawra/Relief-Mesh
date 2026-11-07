import type { ApplicationStatus } from '@reliefmesh/shared';
import { STATUS_LABELS } from '../lib/format';

// green = completed/confirmed, amber = needs review, red = blocked, blue = informational.
const TONE: Record<ApplicationStatus, string> = {
  submitted: 'bg-amber-100 text-amber-900',
  needs_information: 'bg-amber-100 text-amber-900',
  under_review: 'bg-amber-100 text-amber-900',
  delivery_submitted: 'bg-amber-100 text-amber-900',
  approved: 'bg-sky-100 text-sky-900',
  funded: 'bg-sky-100 text-sky-900',
  delivery_verified: 'bg-emerald-100 text-emerald-900',
  completed: 'bg-emerald-100 text-emerald-900',
  flagged: 'bg-red-100 text-red-900',
  cancelled: 'bg-red-100 text-red-900',
  expired: 'bg-red-100 text-red-900',
  rejected: 'bg-red-100 text-red-900',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
