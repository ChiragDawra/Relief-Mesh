import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AI_DISCLAIMER, type CaseAiPanel, type IntakeResult, type TriageResponse } from '@reliefmesh/shared';
import { ErrorState } from '../../components/States';
import { apiFetch } from '../../lib/api';
import { humanize } from '../../lib/format';

function providerLabel(provider: string, modelVersion: string): string {
  return provider === 'mock' ? 'Demo AI fixture (deterministic rules)' : `External model · ${modelVersion}`;
}

function Chips({ values, tone }: { values: string[]; tone: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span key={v} className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>
          {humanize(v)}
        </span>
      ))}
    </div>
  );
}

interface Props {
  caseId: string;
  ai: CaseAiPanel;
  canRetry: boolean;
  onUseDraft?: (draft: IntakeResult) => void;
}

/** Shows AI suggestions as suggestions. Nothing here changes case status or approves anything. */
export function AiPanel({ caseId, ai, canRetry, onUseDraft }: Props) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => apiFetch<TriageResponse>(`/cases/${caseId}/triage`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });
  const intake = ai.intake;

  return (
    <div className="space-y-4 text-sm">
      <p className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900">
        <Sparkles className="size-3.5" aria-hidden /> {AI_DISCLAIMER}
      </p>

      {(ai.ai_status === 'unavailable' || ai.ai_status === 'failed' || !intake) && (
        <div className="rounded-md bg-amber-50 p-3 text-amber-900">
          {ai.ai_status === 'pending' ? 'AI triage has not run yet.' : 'AI assistance is unavailable.'} The request is
          saved; continue with manual review.
        </div>
      )}

      {intake && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {providerLabel(intake.provider, intake.model_version)} · confidence {Math.round(intake.result.confidence * 100)}%
          </p>
          {intake.needs_review && (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Low confidence or missing urgency signal — a person must complete this record.
            </p>
          )}
          <p className="font-medium">{intake.result.summary}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Suggested category</dt>
              <dd className="capitalize">{humanize(intake.result.category)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Households</dt>
              <dd>{intake.result.household_count ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Urgency suggestion</dt>
              <dd>{intake.result.urgency_suggestion ?? 'No suggestion — needs human judgement'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Items</dt>
              <dd>
                {intake.result.requested_items
                  .map((i) => `${humanize(i.name)} ${i.quantity ?? '(quantity unknown)'} ${i.unit ?? ''}`.trim())
                  .join('; ') || 'None found'}
              </dd>
            </div>
          </dl>
          {intake.result.urgency_reasons.length > 0 && (
            <p className="text-xs text-slate-600">Why: {intake.result.urgency_reasons.join(' ')}</p>
          )}
          {intake.result.missing_fields.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-slate-500">Missing information</p>
              <Chips values={intake.result.missing_fields} tone="bg-amber-100 text-amber-900" />
            </div>
          )}
          {intake.result.uncertainties.length > 0 && (
            <ul className="list-inside list-disc text-xs text-slate-600">
              {intake.result.uncertainties.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          )}
          {onUseDraft && (
            <button
              type="button"
              onClick={() => onUseDraft(intake.result)}
              className="rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-violet-300"
            >
              Review AI draft in the correction form
            </button>
          )}
        </div>
      )}

      {ai.duplicates && ai.duplicates.candidates.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          {ai.duplicates.candidates.map((c) => (
            <div key={c.case_id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="font-medium text-amber-900">Possible duplicate — review required</p>
              <p className="text-xs text-amber-900">
                {c.public_ref ? (
                  <Link to={`/app/cases/${c.case_id}`} className="font-mono underline">
                    {c.public_ref}
                  </Link>
                ) : (
                  'Related case'
                )}{' '}
                · ranking score {c.similarity_score.toFixed(2)} (not a fraud probability)
              </p>
              {c.reasons.length > 0 && <p className="mt-1 text-xs">Similar: {c.reasons.join('; ')}</p>}
              {c.differences.length > 0 && <p className="text-xs">Different: {c.differences.join('; ')}</p>}
            </div>
          ))}
          <p className="text-xs text-slate-500">{ai.duplicates.disclaimer}</p>
        </div>
      )}

      {retry.isError && <ErrorState error={retry.error} />}
      {canRetry && (
        <button
          type="button"
          disabled={retry.isPending}
          onClick={() => retry.mutate()}
          className="rounded-md px-3 py-1.5 text-xs ring-1 ring-slate-300 disabled:opacity-60"
        >
          {retry.isPending ? 'Running AI triage…' : 'Re-run AI triage'}
        </button>
      )}
    </div>
  );
}
