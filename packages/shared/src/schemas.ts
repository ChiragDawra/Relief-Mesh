import { z } from 'zod';
import { DEMO_TOKEN_DECIMALS } from './constants';
import {
  APPLICATION_STATUSES,
  CASE_CATEGORIES,
  REASON_CODES,
  URGENCY_LEVELS,
} from './enums';

export const U64_MAX = 18_446_744_073_709_551_615n;

/** Token amounts travel as decimal strings of integer base units (never JS numbers). */
export const baseUnitsSchema = z
  .string()
  .refine(
    (v) => /^\d{1,20}$/.test(v) && BigInt(v) > 0n && BigInt(v) <= U64_MAX,
    'must be a positive u64 integer base-unit string',
  );

export const walletPubkeySchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'must be a base58 Solana public key');

export const categorySchema = z.enum(CASE_CATEGORIES);
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const urgencySchema = z.enum(URGENCY_LEVELS);

export const requestedItemSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    quantity: z.number().int().positive().max(1_000_000).nullable(),
    unit: z.string().trim().min(1).max(30).nullable(),
  })
  .strict();
export type RequestedItem = z.infer<typeof requestedItemSchema>;

const descriptionSchema = z.string().trim().min(5).max(5000);
const localitySchema = z.string().trim().min(2).max(120);
const householdCountSchema = z.number().int().positive().max(10_000).nullable();

export const createCaseSchema = z
  .object({
    organization_id: z.uuid(),
    description: descriptionSchema,
    locality_label: localitySchema,
    requested_amount_base_units: baseUnitsSchema,
    token_decimals: z.literal(DEMO_TOKEN_DECIMALS),
    category_hint: categorySchema.optional(),
    requested_items: z.array(requestedItemSchema).max(20).optional(),
  })
  .strict();
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const updateCaseSchema = z
  .object({
    category: categorySchema,
    household_count: householdCountSchema,
    requested_items: z.array(requestedItemSchema).max(20),
    locality_label: localitySchema,
    requested_amount_base_units: baseUnitsSchema,
    urgency_human_override: urgencySchema.nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'at least one field is required');
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

const reviewBase = {
  reason_code: z.enum(REASON_CODES),
  review_note: z.string().trim().max(2000).optional(),
};

export const reviewCaseSchema = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('approve'),
      ...reviewBase,
      supplier_organization_id: z.uuid(),
      supplier_wallet_pubkey: walletPubkeySchema,
      target_amount_base_units: baseUnitsSchema,
      expires_at: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      decision: z.literal(['needs_information', 'flag', 'reject']),
      ...reviewBase,
    })
    .strict(),
]);
export type ReviewCaseInput = z.infer<typeof reviewCaseSchema>;

export const listCasesQuerySchema = z
  .object({
    status: applicationStatusSchema.optional(),
    category: categorySchema.optional(),
    organization_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;
