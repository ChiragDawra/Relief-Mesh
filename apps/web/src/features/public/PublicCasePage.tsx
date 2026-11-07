import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { DEMO_DISCLAIMER, type PublicCaseResponse } from '@reliefmesh/shared';
import { Card, ErrorState, Field, Loading } from '../../components/States';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { apiFetch } from '../../lib/api';
import { formatDateTime, formatTokens, humanize } from '../../lib/format';

/** Public-safe transparency receipt: no beneficiary data, request text or evidence. */
export function PublicCasePage() {
  const { publicRef = '' } = useParams();
  const query = useQuery({
    queryKey: ['public-case', publicRef],
    queryFn: () => apiFetch<PublicCaseResponse>(`/public/cases/${encodeURIComponent(publicRef)}`),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
      <h1 className="text-xl font-semibold text-navy">Transparency receipt · {publicRef}</h1>
      <p className="text-sm text-slate-600">{DEMO_DISCLAIMER}</p>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Card title="Case summary" aside={<StatusBadge status={query.data.case.application_status} />}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Need">{humanize(query.data.case.category)}</Field>
              <Field label="Locality">{query.data.case.locality_label}</Field>
              <Field label="Approved amount">
                {formatTokens(query.data.case.approved_amount_base_units, query.data.case.token_decimals)}
              </Field>
              <Field label="Opened">{formatDateTime(query.data.case.created_at)}</Field>
            </dl>
          </Card>
          <Card title="Public timeline">
            <Timeline entries={query.data.timeline} />
          </Card>
        </>
      )}
    </div>
  );
}
