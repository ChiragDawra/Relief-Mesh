import type { Role } from '@reliefmesh/shared';
import { createApp } from '../../src/app';
import type { TokenVerifier } from '../../src/auth/middleware';
import { loadConfig } from '../../src/config';
import type { Membership } from '../../src/domain/types';
import { MemoryRepository } from './memoryRepository';

export const ORG = {
  ngoA: '10000000-0000-4000-8000-000000000001',
  supplier: '10000000-0000-4000-8000-000000000002',
  donorGroup: '10000000-0000-4000-8000-000000000003',
  ngoB: '20000000-0000-4000-8000-0000000000b1',
} as const;

/** Synthetic base58 strings; not real keys. */
export const WALLET = {
  reviewer: 'Rev1ewerDemoWa11et1111111111111111111111111',
  supplier: 'Supp1ierDemoWa11et111111111111111111111111',
  donor: 'DonorDemoWa11et11111111111111111111111111111',
} as const;

export const USER = {
  fieldWorker: 'aaaaaaaa-0000-4000-8000-000000000001',
  reviewer: 'aaaaaaaa-0000-4000-8000-000000000002',
  otherReviewer: 'aaaaaaaa-0000-4000-8000-000000000003',
  supplier: 'aaaaaaaa-0000-4000-8000-000000000004',
  donor: 'aaaaaaaa-0000-4000-8000-000000000005',
  outsider: 'aaaaaaaa-0000-4000-8000-000000000006',
} as const;

function member(orgId: string, name: string, type: Membership['organization_type'], role: Role, wallet: string | null = null): Membership {
  return { organization_id: orgId, organization_name: name, organization_type: type, role, wallet_pubkey: wallet };
}

export const NOW = new Date('2026-11-07T12:00:00Z');

export function buildTestApp() {
  const repo = new MemoryRepository({
    profiles: Object.entries(USER).map(([name, id]) => ({ id, display_name: `Demo ${name}`, default_wallet_pubkey: null })),
    memberships: {
      [USER.fieldWorker]: [member(ORG.ngoA, 'Demo NGO', 'ngo', 'field_worker')],
      [USER.reviewer]: [member(ORG.ngoA, 'Demo NGO', 'ngo', 'ngo_reviewer', WALLET.reviewer)],
      [USER.otherReviewer]: [member(ORG.ngoB, 'Demo NGO B', 'ngo', 'ngo_reviewer')],
      [USER.supplier]: [member(ORG.supplier, 'Demo Supplier', 'supplier', 'supplier', WALLET.supplier)],
      [USER.donor]: [member(ORG.donorGroup, 'Demo Donors', 'donor_group', 'donor', WALLET.donor)],
    },
    suppliers: [{ organization_id: ORG.supplier, name: 'Demo Supplier', wallet_pubkeys: [WALLET.supplier] }],
  });
  const verifier: TokenVerifier = {
    verify: async (token) => (token.startsWith('test-token:') ? token.slice('test-token:'.length) : null),
  };
  const app = createApp(loadConfig({ NODE_ENV: 'test' }), { repo, verifier, now: () => NOW });
  return { app, repo };
}

export const bearer = (userId: string) => `Bearer test-token:${userId}`;

export const newCaseBody = {
  organization_id: ORG.ngoA,
  description: 'Five families in Demo Ward 4 need drinking water after the flood. Call +1 555 010 9999.',
  locality_label: 'Demo Ward 4',
  requested_amount_base_units: '25000000',
  token_decimals: 6,
  category_hint: 'water',
};

export const approvalBody = {
  decision: 'approve',
  reason_code: 'complete_request',
  review_note: 'Synthetic note: verified with field team.',
  supplier_organization_id: ORG.supplier,
  supplier_wallet_pubkey: WALLET.supplier,
  target_amount_base_units: '25000000',
  expires_at: '2026-11-08T12:00:00Z',
};
