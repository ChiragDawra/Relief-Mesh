/**
 * Creates the synthetic demo Auth users, profiles and memberships (ADR-017).
 * Requires the organizations from supabase/seed.sql. Uses wallet PUBLIC keys only.
 *
 *   npm run seed:demo
 */
import { createClient, type User } from '@supabase/supabase-js';

const ORG = {
  ngo: '10000000-0000-4000-8000-000000000001',
  supplier: '10000000-0000-4000-8000-000000000002',
  donorGroup: '10000000-0000-4000-8000-000000000003',
} as const;

type Role = 'field_worker' | 'ngo_reviewer' | 'supplier' | 'donor';

interface DemoUser {
  email: string;
  displayName: string;
  organizationId: string;
  role: Role;
  walletEnv?: string;
}

const DEMO_USERS: DemoUser[] = [
  { email: 'fieldworker@demo.reliefmesh.test', displayName: 'Demo Field Volunteer', organizationId: ORG.ngo, role: 'field_worker' },
  { email: 'reviewer@demo.reliefmesh.test', displayName: 'Demo NGO Reviewer', organizationId: ORG.ngo, role: 'ngo_reviewer', walletEnv: 'DEMO_REVIEWER_WALLET' },
  { email: 'supplier@demo.reliefmesh.test', displayName: 'Demo Supplier', organizationId: ORG.supplier, role: 'supplier', walletEnv: 'DEMO_SUPPLIER_WALLET' },
  { email: 'donor@demo.reliefmesh.test', displayName: 'Demo Donor', organizationId: ORG.donorGroup, role: 'donor', walletEnv: 'DEMO_DONOR_WALLET' },
];

const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function walletFor(user: DemoUser): string | null {
  if (!user.walletEnv) return null;
  const value = requireEnv(user.walletEnv);
  if (!BASE58_PUBKEY.test(value)) throw new Error(`${user.walletEnv} is not a base58 public key`);
  return value;
}

const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = requireEnv('DEMO_USER_PASSWORD');

async function findUserByEmail(email: string): Promise<User | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match || data.users.length < 200) return match;
  }
}

async function ensureAuthUser(user: DemoUser): Promise<string> {
  const existing = await findUserByEmail(user.email);
  if (existing) return existing.id;
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: user.displayName, demo_only: true },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const { count, error: orgError } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .in('id', Object.values(ORG));
  if (orgError) throw orgError;
  if (count !== Object.keys(ORG).length) {
    throw new Error('Demo organizations missing — run `supabase db reset` (applies supabase/seed.sql) first.');
  }

  for (const user of DEMO_USERS) {
    const wallet = walletFor(user);
    const userId = await ensureAuthUser(user);

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: user.displayName, default_wallet_pubkey: wallet });
    if (profileError) throw profileError;

    const { error: membershipError } = await supabase
      .from('memberships')
      .upsert(
        { organization_id: user.organizationId, user_id: userId, role: user.role, wallet_pubkey: wallet },
        { onConflict: 'organization_id,user_id,role' },
      );
    if (membershipError) throw membershipError;

    console.log(`seeded ${user.role.padEnd(12)} ${user.email}`);
  }
}

main().catch((err: unknown) => {
  // Supabase client errors are plain objects with a message, not Error instances.
  const message = (err as { message?: string } | null)?.message;
  console.error(`seed-demo failed: ${message || 'Supabase unreachable — is `supabase start` running?'}`);
  process.exit(1);
});
