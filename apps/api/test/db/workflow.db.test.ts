import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Runs against a database with all migrations + seed.sql applied:
 * local Supabase (`supabase start`) or plain Postgres with supabase/tests/plain-postgres-stubs.sql.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for database tests');

const NGO_A = '10000000-0000-4000-8000-000000000001';
const SUPPLIER_ORG = '10000000-0000-4000-8000-000000000002';
const DONOR_ORG = '10000000-0000-4000-8000-000000000003';
const NGO_B = '20000000-0000-4000-8000-0000000000b1';

const user = {
  reviewerA: randomUUID(),
  reviewerB: randomUUID(),
  supplier: randomUUID(),
  donor: randomUUID(),
};

let client: pg.Client;
let caseId: string;

async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  return client.query<T>(sql, params);
}

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
  await q('set local role authenticated');
  // On error the transaction is aborted; expectDbError's savepoint rollback restores the role.
  const result = await fn();
  await q('reset role');
  return result;
}

async function expectDbError(fn: () => Promise<unknown>, pattern: RegExp) {
  await q('savepoint expect_error');
  try {
    await fn();
    throw new Error('expected database error');
  } catch (err) {
    expect((err as Error).message).toMatch(pattern);
  } finally {
    await q('rollback to savepoint expect_error');
    await q('reset role');
  }
}

function transition(from: string, to: string, approval: object | null = null) {
  return q<{ event_id: string | null }>(
    `select public.transition_case($1, $2, $3, $4, 'ngo_reviewer', 'case_status_changed', '{}'::jsonb, null, 'private note', $5) as event_id`,
    [caseId, from, to, user.reviewerA, approval],
  );
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

beforeEach(async () => {
  await q('begin');
  await q(`insert into public.organizations (id, name, organization_type) values ($1, 'Demo NGO B', 'ngo')`, [NGO_B]);
  for (const [name, id] of Object.entries(user)) {
    await q('insert into auth.users (id, email) values ($1, $2)', [id, `${name}-${id}@demo.reliefmesh.test`]);
    await q('insert into public.profiles (id, display_name) values ($1, $2)', [id, `Demo ${name}`]);
  }
  await q(
    `insert into public.memberships (organization_id, user_id, role) values
       ($1, $5, 'ngo_reviewer'), ($2, $6, 'ngo_reviewer'), ($3, $7, 'supplier'), ($4, $8, 'donor')`,
    [NGO_A, NGO_B, SUPPLIER_ORG, DONOR_ORG, user.reviewerA, user.reviewerB, user.supplier, user.donor],
  );
  const res = await q<{ id: string }>(
    `insert into public.relief_cases
       (organization_id, created_by, category, description_redacted, locality_label,
        requested_amount_base_units, token_decimals, case_ref_hash)
     values ($1, $2, 'water', 'Synthetic request for drinking water', 'Demo Ward 4', 25000000, 6, $3)
     returning id`,
    [NGO_A, user.reviewerA, randomBytes(32).toString('hex')],
  );
  caseId = res.rows[0]!.id;
});

afterEach(async () => {
  await q('rollback');
});

describe('relief_cases defaults', () => {
  it('generates a non-identifying public reference', async () => {
    const res = await q<{ public_ref: string }>('select public_ref from public.relief_cases where id = $1', [caseId]);
    expect(res.rows[0]!.public_ref).toMatch(/^RM-DEMO-\d{4,}$/);
  });
});

describe('transition_case', () => {
  it('applies an allowed transition once and records one event', async () => {
    const first = await transition('submitted', 'under_review');
    expect(first.rows[0]!.event_id).toMatch(/^[0-9a-f-]{36}$/);

    const retry = await transition('submitted', 'under_review');
    expect(retry.rows[0]!.event_id).toBeNull();

    const events = await q<{ n: string; note: string }>(
      `select count(*) as n, max(internal_note) as note from public.case_events where case_id = $1`,
      [caseId],
    );
    expect(events.rows[0]).toEqual({ n: '1', note: 'private note' });
  });

  it('rejects a transition outside the lifecycle', async () => {
    await expectDbError(() => transition('submitted', 'approved'), /not allowed/);
  });

  it('requires complete escrow terms for approval', async () => {
    await transition('submitted', 'under_review');
    await expectDbError(() => transition('under_review', 'approved'), /relief_cases_approval_complete/);

    const ok = await transition('under_review', 'approved', {
      approved_amount_base_units: '25000000',
      escrow_expires_at: '2030-01-01T00:00:00Z',
      assigned_supplier_organization_id: SUPPLIER_ORG,
      supplier_wallet_pubkey: '11111111111111111111111111111111',
    });
    expect(ok.rows[0]!.event_id).not.toBeNull();
  });

  it('cannot be executed by browser roles', async () => {
    await expectDbError(() => asUser(user.reviewerA, () => transition('submitted', 'under_review')), /permission denied/);
  });
});

describe('immutability', () => {
  it('blocks updates to audit events', async () => {
    await transition('submitted', 'under_review');
    await expectDbError(() => q(`update public.case_events set event_type = 'x' where case_id = $1`, [caseId]), /immutable/);
  });
});

describe('row level security', () => {
  const visibleCases = (userId: string) =>
    asUser(userId, async () => (await q('select id from public.relief_cases where id = $1', [caseId])).rowCount);

  it('lets the owning organization reviewer read the case', async () => {
    expect(await visibleCases(user.reviewerA)).toBe(1);
  });

  it('hides the case from another organization', async () => {
    expect(await visibleCases(user.reviewerB)).toBe(0);
  });

  it('hides unassigned cases from suppliers and private rows from donors', async () => {
    expect(await visibleCases(user.supplier)).toBe(0);
    expect(await visibleCases(user.donor)).toBe(0);
  });

  it('shows the case to the supplier once assigned', async () => {
    await q('update public.relief_cases set assigned_supplier_organization_id = $1 where id = $2', [SUPPLIER_ORG, caseId]);
    expect(await visibleCases(user.supplier)).toBe(1);
  });

  it('blocks browser roles from writing audit events directly', async () => {
    await expectDbError(
      () =>
        asUser(user.reviewerA, () =>
          q(`insert into public.case_events (case_id, actor_role, event_type) values ($1, 'ngo_reviewer', 'forged')`, [caseId]),
        ),
      /row-level security/,
    );
  });
});
