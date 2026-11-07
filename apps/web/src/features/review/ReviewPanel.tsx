import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  DEMO_TOKEN_DECIMALS,
  DEMO_TOKEN_LABEL,
  formatBaseUnits,
  parseDisplayAmount,
  REASON_CODES,
  REVIEW_DECISIONS,
  reviewCaseSchema,
  type MutationResponse,
  type ReviewCaseInput,
  type StaffCase,
  type SupplierOrganization,
} from '@reliefmesh/shared';
import { ErrorState, Loading } from '../../components/States';
import { apiFetch } from '../../lib/api';
import { formatDateTime, formatTokens, humanize } from '../../lib/format';

const formSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  reason_code: z.enum(REASON_CODES),
  review_note: z.string().max(2000),
  supplier_organization_id: z.string(),
  supplier_wallet_pubkey: z.string(),
  amount: z.string(),
  expires_local: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const input = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm';

function defaultExpiry(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function toReviewInput(v: FormValues): ReviewCaseInput {
  const base = { reason_code: v.reason_code, ...(v.review_note.trim() ? { review_note: v.review_note.trim() } : {}) };
  if (v.decision !== 'approve') return reviewCaseSchema.parse({ decision: v.decision, ...base });
  return reviewCaseSchema.parse({
    decision: 'approve',
    ...base,
    supplier_organization_id: v.supplier_organization_id,
    supplier_wallet_pubkey: v.supplier_wallet_pubkey,
    target_amount_base_units: parseDisplayAmount(v.amount, DEMO_TOKEN_DECIMALS),
    expires_at: new Date(v.expires_local).toISOString(),
  });
}

/** Human review decision. Approval records escrow terms; it does not create the escrow on-chain. */
export function ReviewPanel({ caseRecord }: { caseRecord: StaffCase }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ReviewCaseInput | null>(null);
  const [formError, setFormError] = useState<Error | null>(null);
  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiFetch<{ suppliers: SupplierOrganization[] }>('/suppliers'),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      decision: 'approve',
      reason_code: 'complete_request',
      review_note: '',
      supplier_organization_id: '',
      supplier_wallet_pubkey: '',
      amount: formatBaseUnits(caseRecord.requested_amount_base_units, caseRecord.token_decimals).replace(/,/g, ''),
      expires_local: defaultExpiry(),
    },
  });
  const decision = useWatch({ control: form.control, name: 'decision' });
  const supplierId = useWatch({ control: form.control, name: 'supplier_organization_id' });
  const wallets = suppliers.data?.suppliers.find((s) => s.organization_id === supplierId)?.wallet_pubkeys ?? [];

  const submit = useMutation({
    mutationFn: (body: ReviewCaseInput) =>
      apiFetch<MutationResponse>(`/cases/${caseRecord.id}/review`, { method: 'POST', body }),
    onSuccess: async () => {
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ['case', caseRecord.id] });
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  function prepare(values: FormValues) {
    try {
      setFormError(null);
      setPending(toReviewInput(values));
    } catch {
      setFormError(new Error('Complete supplier, wallet, a positive amount and a valid expiry to approve.'));
    }
  }

  if (pending) {
    const supplierName = suppliers.data?.suppliers.find(
      (s) => pending.decision === 'approve' && s.organization_id === pending.supplier_organization_id,
    )?.name;
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">Confirm your decision: {humanize(pending.decision)}</p>
        {pending.decision === 'approve' && (
          <dl className="grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Supplier</dt>
              <dd>{supplierName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Supplier wallet</dt>
              <dd className="break-all font-mono text-xs">{pending.supplier_wallet_pubkey}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Escrow amount</dt>
              <dd>{formatTokens(pending.target_amount_base_units, DEMO_TOKEN_DECIMALS)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Expires</dt>
              <dd>{formatDateTime(pending.expires_at)}</dd>
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              {DEMO_TOKEN_LABEL}. Approval is recorded in ReliefMesh; the escrow is created on Solana Devnet only when you
              sign the create-case transaction.
            </p>
          </dl>
        )}
        {submit.isError && <ErrorState error={submit.error} />}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submit.isPending}
            onClick={() => submit.mutate(pending)}
            className="rounded-md bg-navy px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {submit.isPending ? 'Recording…' : 'Confirm decision'}
          </button>
          <button type="button" onClick={() => setPending(null)} className="rounded-md px-4 py-2 ring-1 ring-slate-300">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(prepare)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Decision
          <select {...form.register('decision')} className={input}>
            {REVIEW_DECISIONS.map((d) => (
              <option key={d} value={d}>
                {humanize(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Reason
          <select {...form.register('reason_code')} className={input}>
            {REASON_CODES.map((r) => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {decision === 'approve' &&
        (suppliers.isPending ? (
          <Loading label="Loading suppliers…" />
        ) : suppliers.isError ? (
          <ErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Supplier organization
              <select {...form.register('supplier_organization_id')} className={input}>
                <option value="">Choose…</option>
                {suppliers.data.suppliers.map((s) => (
                  <option key={s.organization_id} value={s.organization_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Supplier wallet (registered)
              <select {...form.register('supplier_wallet_pubkey')} className={`${input} font-mono text-xs`}>
                <option value="">Choose…</option>
                {wallets.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Escrow amount (demo tokens)
              <input {...form.register('amount')} inputMode="decimal" className={input} />
            </label>
            <label className="text-sm">
              Escrow expiry
              <input type="datetime-local" {...form.register('expires_local')} className={input} />
            </label>
          </div>
        ))}

      <label className="block text-sm">
        Private review note
        <textarea rows={2} {...form.register('review_note')} className={input} placeholder="Visible to NGO reviewers only" />
      </label>

      {formError && <ErrorState error={formError} />}
      <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white">
        Review summary
      </button>
    </form>
  );
}
