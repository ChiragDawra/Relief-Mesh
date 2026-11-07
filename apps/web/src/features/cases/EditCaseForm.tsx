import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CASE_CATEGORIES,
  DEMO_TOKEN_DECIMALS,
  formatBaseUnits,
  parseDisplayAmount,
  updateCaseSchema,
  URGENCY_LEVELS,
  type IntakeResult,
  type MutationResponse,
  type StaffCase,
} from '@reliefmesh/shared';
import { ErrorState } from '../../components/States';
import { apiFetch } from '../../lib/api';
import { humanize } from '../../lib/format';

const optionalInt = z
  .string()
  .refine((v) => v === '' || /^\d{1,5}$/.test(v), 'Whole number or leave blank');

const formSchema = z.object({
  category: z.enum(CASE_CATEGORIES),
  household_count: optionalInt,
  locality_label: z.string().trim().min(2).max(120),
  amount: z.string().refine((v) => (parseDisplayAmount(v, DEMO_TOKEN_DECIMALS) ?? '0') !== '0', 'Enter a positive amount'),
  urgency_human_override: z.enum(URGENCY_LEVELS).or(z.literal('')),
  requested_items: z.array(
    z.object({ name: z.string().trim().min(1, 'Required').max(80), quantity: optionalInt, unit: z.string().trim().max(30) }),
  ),
});
type FormValues = z.infer<typeof formSchema>;

const input = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm';

interface Props {
  caseRecord: StaffCase;
  /** AI draft to pre-fill; the volunteer still reviews and saves it explicitly. */
  draft?: IntakeResult | null;
  onDone: () => void;
}

/** Volunteer correction of the structured fields (allowed while submitted / needs information). */
export function EditCaseForm({ caseRecord, draft, onDone }: Props) {
  const queryClient = useQueryClient();
  const householdCount = draft ? draft.household_count : caseRecord.household_count;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: draft?.category ?? caseRecord.category,
      household_count: householdCount?.toString() ?? '',
      locality_label: caseRecord.locality_label,
      amount: formatBaseUnits(caseRecord.requested_amount_base_units, caseRecord.token_decimals).replace(/,/g, ''),
      urgency_human_override: caseRecord.urgency_human_override ?? '',
      requested_items: (draft?.requested_items ?? caseRecord.requested_items).map((i) => ({
        name: i.name,
        quantity: i.quantity?.toString() ?? '',
        unit: i.unit ?? '',
      })),
    },
  });
  const items = useFieldArray({ control: form.control, name: 'requested_items' });

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      apiFetch<MutationResponse>(`/cases/${caseRecord.id}`, {
        method: 'PATCH',
        body: updateCaseSchema.parse({
          category: v.category,
          household_count: v.household_count === '' ? null : Number(v.household_count),
          locality_label: v.locality_label,
          requested_amount_base_units: parseDisplayAmount(v.amount, DEMO_TOKEN_DECIMALS),
          urgency_human_override: v.urgency_human_override || null,
          requested_items: v.requested_items.map((i) => ({
            name: i.name,
            quantity: i.quantity === '' ? null : Number(i.quantity),
            unit: i.unit || null,
          })),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['case', caseRecord.id] });
      onDone();
    },
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Category
          <select {...form.register('category')} className={input}>
            {CASE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Households
          <input {...form.register('household_count')} inputMode="numeric" className={input} placeholder="Unknown" />
          {errors.household_count && <span className="text-xs text-red-700">{errors.household_count.message}</span>}
        </label>
        <label className="text-sm">
          Locality
          <input {...form.register('locality_label')} className={input} />
        </label>
        <label className="text-sm">
          Requested amount (demo tokens)
          <input {...form.register('amount')} inputMode="decimal" className={input} />
          {errors.amount && <span className="text-xs text-red-700">{errors.amount.message}</span>}
        </label>
        <label className="text-sm">
          Urgency (human decision)
          <select {...form.register('urgency_human_override')} className={input}>
            <option value="">Not set</option>
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Requested items</legend>
        {items.fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <input {...form.register(`requested_items.${index}.name`)} placeholder="Item" className={input} />
            <input {...form.register(`requested_items.${index}.quantity`)} placeholder="Qty" className={`${input} w-24`} />
            <input {...form.register(`requested_items.${index}.unit`)} placeholder="Unit" className={`${input} w-28`} />
            <button type="button" onClick={() => items.remove(index)} aria-label="Remove item" className="mt-1 text-slate-500">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => items.append({ name: '', quantity: '', unit: '' })}
          className="inline-flex items-center gap-1 text-xs text-sky-700"
        >
          <Plus className="size-3.5" /> Add item
        </button>
      </fieldset>

      {save.isError && <ErrorState error={save.error} />}
      <div className="flex gap-2">
        <button type="submit" disabled={save.isPending} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {save.isPending ? 'Saving…' : 'Save corrections'}
        </button>
        <button type="button" onClick={onDone} className="rounded-md px-4 py-2 text-sm ring-1 ring-slate-300">
          Cancel
        </button>
      </div>
    </form>
  );
}
