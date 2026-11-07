import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  CASE_CATEGORIES,
  createCaseSchema,
  DEMO_TOKEN_DECIMALS,
  DEMO_TOKEN_LABEL,
  parseDisplayAmount,
  type MutationResponse,
} from '@reliefmesh/shared';
import { Card, ErrorState } from '../../components/States';
import { apiFetch } from '../../lib/api';
import { membershipsWithRole, useAuth } from '../../lib/auth';
import { humanize } from '../../lib/format';

const formSchema = z.object({
  organization_id: z.uuid('Choose an organization'),
  description: z.string().trim().min(5, 'Describe the need in at least 5 characters').max(5000),
  locality_label: z.string().trim().min(2, 'Enter a general synthetic locality').max(120),
  amount: z
    .string()
    .refine((v) => (parseDisplayAmount(v, DEMO_TOKEN_DECIMALS) ?? '0') !== '0', 'Enter a positive amount (max 6 decimals)'),
  category_hint: z.enum(CASE_CATEGORIES).or(z.literal('')),
});
type FormValues = z.infer<typeof formSchema>;

const input = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2';

export function NewCasePage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizations = membershipsWithRole(me, ['field_worker', 'admin']);
  // One key per form instance makes retries of the same submission idempotent (ADR-016).
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization_id: organizations[0]?.organization_id ?? '',
      description: '',
      locality_label: '',
      amount: '',
      category_hint: '',
    },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => {
      const body = createCaseSchema.parse({
        organization_id: values.organization_id,
        description: values.description,
        locality_label: values.locality_label,
        requested_amount_base_units: parseDisplayAmount(values.amount, DEMO_TOKEN_DECIMALS),
        token_decimals: DEMO_TOKEN_DECIMALS,
        ...(values.category_hint ? { category_hint: values.category_hint } : {}),
      });
      return apiFetch<MutationResponse>('/cases', {
        method: 'POST',
        body,
        headers: { 'idempotency-key': idempotencyKey },
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
      navigate(`/app/cases/${res.case.id}`);
    },
  });

  const errors = form.formState.errors;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-navy">New synthetic relief request</h1>
      <p className="text-sm text-slate-600">
        Use invented details only. Do not enter names, phone numbers, exact addresses or medical information. The
        request is saved before any AI processing.
      </p>
      <Card>
        <form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="space-y-4" noValidate>
          <label className="block text-sm">
            <span className="font-medium">Organization</span>
            <select {...form.register('organization_id')} className={input}>
              {organizations.map((m) => (
                <option key={m.organization_id} value={m.organization_id}>
                  {m.organization_name}
                </option>
              ))}
            </select>
            {errors.organization_id && <p className="mt-1 text-xs text-red-700">{errors.organization_id.message}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">Request in plain language</span>
            <textarea
              rows={5}
              {...form.register('description')}
              className={input}
              placeholder="Five families in Demo Ward 4 need drinking water after the flood…"
            />
            {errors.description && <p className="mt-1 text-xs text-red-700">{errors.description.message}</p>}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">General locality (synthetic)</span>
              <input {...form.register('locality_label')} className={input} placeholder="Demo Ward 4" />
              {errors.locality_label && <p className="mt-1 text-xs text-red-700">{errors.locality_label.message}</p>}
            </label>
            <label className="block text-sm">
              <span className="font-medium">Category (optional hint)</span>
              <select {...form.register('category_hint')} className={input}>
                <option value="">Let AI suggest / decide later</option>
                {CASE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium">Requested amount</span>
            <input {...form.register('amount')} inputMode="decimal" className={input} placeholder="25" />
            <span className="mt-1 block text-xs text-slate-500">{DEMO_TOKEN_LABEL}</span>
            {errors.amount && <p className="mt-1 text-xs text-red-700">{errors.amount.message}</p>}
          </label>

          {create.isError && <ErrorState error={create.error} />}
          <button
            type="submit"
            disabled={create.isPending || organizations.length === 0}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {create.isPending ? 'Saving request…' : 'Save request'}
          </button>
        </form>
      </Card>
    </div>
  );
}
