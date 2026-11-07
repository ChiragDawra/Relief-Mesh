import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ApplicationStatus, CaseView } from '@reliefmesh/shared';
import { Card, ErrorState, Loading } from '../../components/States';
import { apiFetch } from '../../lib/api';
import { hasRole, useAuth } from '../../lib/auth';
import { ROLE_LABELS } from '../../lib/format';

const GROUPS: { label: string; statuses: ApplicationStatus[] }[] = [
  { label: 'Awaiting review', statuses: ['submitted', 'needs_information', 'under_review'] },
  { label: 'Approved / funded', statuses: ['approved', 'funded'] },
  { label: 'Delivery in review', statuses: ['delivery_submitted', 'delivery_verified'] },
  { label: 'Completed', statuses: ['completed'] },
];

export function OverviewPage() {
  const { me } = useAuth();
  const cases = useQuery({
    queryKey: ['cases', 'all'],
    queryFn: () => apiFetch<{ cases: CaseView[] }>('/cases?limit=100'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Welcome, {me?.profile?.display_name ?? 'demo user'}</h1>
        <p className="text-sm text-slate-600">
          {me?.memberships.map((m) => `${ROLE_LABELS[m.role]} · ${m.organization_name}`).join(' — ')}
        </p>
      </div>

      {cases.isPending ? (
        <Loading />
      ) : cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map((group) => (
            <Card key={group.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{group.label}</p>
              <p className="mt-1 text-3xl font-semibold text-navy">
                {cases.data.cases.filter((c) => group.statuses.includes(c.application_status)).length}
              </p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {hasRole(me, ['field_worker', 'admin']) && (
          <Link to="/app/cases/new" className="rounded-md bg-navy px-4 py-2 font-medium text-white">
            Submit a synthetic request
          </Link>
        )}
        {hasRole(me, ['ngo_reviewer', 'admin']) && (
          <Link to="/app/review" className="rounded-md bg-white px-4 py-2 font-medium text-navy ring-1 ring-slate-300">
            Open review queue
          </Link>
        )}
        <Link to="/app/cases" className="rounded-md bg-white px-4 py-2 font-medium text-navy ring-1 ring-slate-300">
          View cases
        </Link>
      </div>
    </div>
  );
}
