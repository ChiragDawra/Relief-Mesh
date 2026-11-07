import { describe, expect, it } from 'vitest';
import { baseUnitsSchema, createCaseSchema, reviewCaseSchema, updateCaseSchema } from '../src/schemas';

const validCase = {
  organization_id: '10000000-0000-4000-8000-000000000001',
  description: 'Synthetic demo request for drinking water',
  locality_label: 'Demo Ward 4',
  requested_amount_base_units: '25000000',
  token_decimals: 6,
};

describe('baseUnitsSchema', () => {
  it('accepts positive u64 strings only', () => {
    expect(baseUnitsSchema.safeParse('18446744073709551615').success).toBe(true);
    expect(baseUnitsSchema.safeParse('18446744073709551616').success).toBe(false);
    expect(baseUnitsSchema.safeParse('0').success).toBe(false);
    expect(baseUnitsSchema.safeParse('25.5').success).toBe(false);
    expect(baseUnitsSchema.safeParse(25000000).success).toBe(false);
  });
});

describe('createCaseSchema', () => {
  it('accepts a valid synthetic request', () => {
    expect(createCaseSchema.safeParse(validCase).success).toBe(true);
  });

  it('rejects unknown fields such as a client-chosen status', () => {
    expect(createCaseSchema.safeParse({ ...validCase, application_status: 'approved' }).success).toBe(false);
  });

  it('rejects a mint decimal mismatch and missing locality', () => {
    expect(createCaseSchema.safeParse({ ...validCase, token_decimals: 9 }).success).toBe(false);
    expect(createCaseSchema.safeParse({ ...validCase, locality_label: '' }).success).toBe(false);
  });
});

describe('updateCaseSchema', () => {
  it('rejects empty and status-changing patches', () => {
    expect(updateCaseSchema.safeParse({}).success).toBe(false);
    expect(updateCaseSchema.safeParse({ application_status: 'approved' }).success).toBe(false);
    expect(updateCaseSchema.safeParse({ household_count: 5 }).success).toBe(true);
  });
});

describe('reviewCaseSchema', () => {
  it('requires escrow terms only for approval', () => {
    expect(reviewCaseSchema.safeParse({ decision: 'approve', reason_code: 'complete_request' }).success).toBe(false);
    expect(reviewCaseSchema.safeParse({ decision: 'flag', reason_code: 'possible_duplicate' }).success).toBe(true);
    expect(
      reviewCaseSchema.safeParse({
        decision: 'approve',
        reason_code: 'complete_request',
        supplier_organization_id: '10000000-0000-4000-8000-000000000002',
        supplier_wallet_pubkey: '11111111111111111111111111111111',
        target_amount_base_units: '25000000',
        expires_at: '2026-11-08T16:00:00Z',
      }).success,
    ).toBe(true);
  });
});
