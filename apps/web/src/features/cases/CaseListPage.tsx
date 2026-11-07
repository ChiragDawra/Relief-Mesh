import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ApplicationStatus, CaseView } from '@reliefmesh/shared';
import { EmptyState, ErrorState, Loading } from '../../components/States';
import { StatusBadge } from '../../components/StatusBadge';
import { apiFetch } from '../../lib/api';
import { formatDateTime, formatTokens, humanize } from '../../lib/format';

function amountOf(c: CaseView): string {
  if (c.view === 'staff') return formatTokens(c.approved_amount_base_units ?? c.requested_amount_base_units, c.token_decimals);
  return formatTokens(c.approved_amount_base_units, c.token_decimals);
}

export function CaseListPage({ title, status }: { title: string; status?: ApplicationStatus }) {
  const query = useQuery({
    queryKey: ['cases', status ?? 'all'],
    queryFn: () => apiFetch<{ cases: CaseView[] }>(`/cases?limit=100${status ? `&status=${status}` : ''}`),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-navy">{title}</h1>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.cases.length === 0 ? (
        <EmptyState title="No cases to show">
          <p>Cases appear here once they are visible to your role.</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Need</th>
                <th className="px-4 py-2">Locality</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data.cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono">
                    <Link to={`/app/cases/${c.id}`} className="text-sky-700 underline">
                      {c.public_ref}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{humanize(c.category)}</td>
                  <td className="px-4 py-2">{c.locality_label}</td>
                  <td className="px-4 py-2">{amountOf(c)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.application_status} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDateTime(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
