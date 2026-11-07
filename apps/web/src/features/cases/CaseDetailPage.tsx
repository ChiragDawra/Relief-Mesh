import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  EDITABLE_STATUSES,
  PUBLIC_STATUSES,
  type CaseDetailResponse,
  type CaseView,
  type IntakeResult,
  type MutationResponse,
} from '@reliefmesh/shared';
import { Card, ErrorState, Field, Loading } from '../../components/States';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import { apiFetch } from '../../lib/api';
import { hasRole, useAuth } from '../../lib/auth';
import { formatDateTime, formatTokens, humanize } from '../../lib/format';
import { ReviewPanel } from '../review/ReviewPanel';
import { AiPanel } from './AiPanel';
import { EditCaseForm } from './EditCaseForm';

const STAFF = ['field_worker', 'ngo_reviewer', 'admin'] as const;

function CaseFacts({ c }: { c: CaseView }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Field label="Need">{humanize(c.category)}</Field>
      <Field label="Locality">{c.locality_label}</Field>
      {c.view === 'staff' && (
        <>
          <Field label="Households">{c.household_count ?? 'Unknown'}</Field>
          <Field label="Requested amount">{formatTokens(c.requested_amount_base_units, c.token_decimals)}</Field>
          <Field label="Urgency (human)">{c.urgency_human_override ?? 'Not set'}</Field>
          <Field label="AI status">{humanize(c.ai_status)}</Field>
        </>
      )}
      <Field label="Approved escrow amount">{formatTokens(c.approved_amount_base_units, c.token_decimals)}</Field>
      <Field label="Escrow expiry">{formatDateTime(c.escrow_expires_at)}</Field>
      {(c.view === 'staff' || c.view === 'supplier') && (
        <Field label="Supplier wallet">
          <span className="break-all font-mono text-xs">{c.supplier_wallet_pubkey ?? '—'}</span>
        </Field>
      )}
      {(c.view === 'staff' || c.view === 'supplier') && (
        <div className="sm:col-span-2">
          <Field label="Requested items">
            {c.requested_items.length === 0 ? (
              'None recorded'
            ) : (
              <ul className="list-inside list-disc">
                {c.requested_items.map((item, i) => (
                  <li key={`${item.name}-${i}`}>
                    {humanize(item.name)} — {item.quantity ?? 'quantity unknown'} {item.unit ?? ''}
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>
      )}
      {c.view === 'staff' && (
        <>
          <div className="sm:col-span-2">
            <Field label="Request text (contact details redacted)">
              <p className="whitespace-pre-wrap">{c.description_redacted}</p>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Opaque on-chain case reference">
              <span className="break-all font-mono text-xs">{c.case_ref_hash}</span>
            </Field>
          </div>
        </>
      )}
    </dl>
  );
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<IntakeResult | null>(null);

  const query = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => apiFetch<CaseDetailResponse>(`/cases/${caseId}`),
  });

  const submit = useMutation({
    mutationFn: () => apiFetch<MutationResponse>(`/cases/${caseId}/submit`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const c = query.data.case;
  const staff = c.view === 'staff' ? c : null;
  const editable = staff !== null && EDITABLE_STATUSES.includes(staff.application_status);
  const canEdit = editable && hasRole(me, ['field_worker', 'admin'], staff.organization_id);
  const canSubmit = editable && hasRole(me, ['field_worker', 'ngo_reviewer', 'admin'], staff.organization_id);
  const canReview =
    staff !== null && staff.application_status === 'under_review' && hasRole(me, ['ngo_reviewer', 'admin'], staff.organization_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-xl font-semibold text-navy">{c.public_ref}</h1>
          <StatusBadge status={c.application_status} />
        </div>
        {PUBLIC_STATUSES.includes(c.application_status) && (
          <Link to={`/public/cases/${c.public_ref}`} className="inline-flex items-center gap-1 text-sm text-sky-700 underline">
            Public receipt <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Case details">
            <CaseFacts c={c} />
          </Card>

          {staff && query.data.ai && (
            <Card title="AI assistance">
              <AiPanel
                caseId={staff.id}
                ai={query.data.ai}
                canRetry={(editable || staff.application_status === 'under_review') && hasRole(me, STAFF, staff.organization_id)}
                onUseDraft={
                  canEdit
                    ? (next) => {
                        setDraft(next);
                        setEditing(true);
                      }
                    : undefined
                }
              />
            </Card>
          )}

          {staff && (canEdit || canSubmit) && (
            <Card title="Volunteer review of the draft">
              {editing ? (
                <EditCaseForm
                  caseRecord={staff}
                  draft={draft}
                  onDone={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Check the structured fields, correct anything wrong, then send the case to the NGO review queue.
                  </p>
                  {submit.isError && <ErrorState error={submit.error} />}
                  <div className="flex gap-2">
                    {canEdit && (
                      <button type="button" onClick={() => setEditing(true)} className="rounded-md px-4 py-2 text-sm ring-1 ring-slate-300">
                        Correct fields
                      </button>
                    )}
                    {canSubmit && (
                      <button
                        type="button"
                        disabled={submit.isPending}
                        onClick={() => submit.mutate()}
                        className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {submit.isPending ? 'Submitting…' : 'Submit for review'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {staff && canReview && (
            <Card title="Human review decision">
              <ReviewPanel caseRecord={staff} />
            </Card>
          )}
        </div>

        <Card title="Audit timeline">
          <Timeline entries={query.data.timeline} />
        </Card>
      </div>
    </div>
  );
}
