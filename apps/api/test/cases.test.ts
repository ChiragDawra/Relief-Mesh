import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { approvalBody, bearer, buildTestApp, newCaseBody, ORG, USER, WALLET } from './support/fixtures';
import type { MemoryRepository } from './support/memoryRepository';

let app: ReturnType<typeof buildTestApp>['app'];
let repo: MemoryRepository;

beforeEach(() => {
  ({ app, repo } = buildTestApp());
});

async function createCase(body: object = newCaseBody) {
  const res = await request(app).post('/api/v1/cases').set('authorization', bearer(USER.fieldWorker)).send(body);
  expect(res.status).toBe(201);
  return res.body.case as { id: string; public_ref: string };
}

async function createApprovedCase() {
  const created = await createCase();
  await request(app).post(`/api/v1/cases/${created.id}/submit`).set('authorization', bearer(USER.fieldWorker)).expect(200);
  await request(app)
    .post(`/api/v1/cases/${created.id}/review`)
    .set('authorization', bearer(USER.reviewer))
    .send(approvalBody)
    .expect(200);
  return created;
}

describe('authentication', () => {
  it('rejects missing and invalid tokens with 401', async () => {
    expect((await request(app).get('/api/v1/cases')).status).toBe(401);
    const res = await request(app).get('/api/v1/cases').set('authorization', 'Bearer forged');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns verified memberships from /me', async () => {
    const res = await request(app).get('/api/v1/me').set('authorization', bearer(USER.reviewer));
    expect(res.status).toBe(200);
    expect(res.body.memberships).toEqual([expect.objectContaining({ organization_id: ORG.ngoA, role: 'ngo_reviewer' })]);
  });
});

describe('POST /cases', () => {
  it('persists a submitted case with an opaque hash and redacted description', async () => {
    const res = await request(app).post('/api/v1/cases').set('authorization', bearer(USER.fieldWorker)).send(newCaseBody);
    expect(res.status).toBe(201);
    expect(res.body.case).toMatchObject({
      application_status: 'submitted',
      ai_status: 'completed',
      category: 'water',
      public_ref: expect.stringMatching(/^RM-DEMO-\d{4}$/),
      case_ref_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(res.body.case.description_redacted).toContain('[redacted phone]');
    expect(res.body.case.description_redacted).not.toContain('555');
    expect(res.body.audit_event_id).toBeTruthy();
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app)
      .post('/api/v1/cases')
      .set('authorization', bearer(USER.fieldWorker))
      .send({ ...newCaseBody, locality_label: undefined, requested_amount_base_units: 25.5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('forbids creating cases for an organization the caller does not belong to', async () => {
    const res = await request(app).post('/api/v1/cases').set('authorization', bearer(USER.otherReviewer)).send(newCaseBody);
    expect(res.status).toBe(403);
  });

  it('is idempotent for a repeated Idempotency-Key', async () => {
    const key = '3b1f6f0e-2c7a-4d8e-9a51-7d2f5c9b0e11';
    const send = () =>
      request(app)
        .post('/api/v1/cases')
        .set('authorization', bearer(USER.fieldWorker))
        .set('idempotency-key', key)
        .send(newCaseBody);
    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.case.id).toBe(first.body.case.id);
    expect(repo.cases.size).toBe(1);
    expect(repo.events.filter((e) => e.event_type === 'case_created')).toHaveLength(1);
  });
});

describe('case visibility', () => {
  it('hides a case from another organization as 404', async () => {
    const created = await createCase();
    const res = await request(app).get(`/api/v1/cases/${created.id}`).set('authorization', bearer(USER.otherReviewer));
    expect(res.status).toBe(404);
    const list = await request(app).get('/api/v1/cases').set('authorization', bearer(USER.otherReviewer));
    expect(list.body.cases).toEqual([]);
  });

  it('hides unapproved cases from suppliers and donors', async () => {
    const created = await createCase();
    for (const user of [USER.supplier, USER.donor, USER.outsider]) {
      const res = await request(app).get(`/api/v1/cases/${created.id}`).set('authorization', bearer(user));
      expect(res.status).toBe(404);
    }
  });

  it('gives donors and the assigned supplier a projection without request text', async () => {
    const created = await createApprovedCase();
    const donor = await request(app).get(`/api/v1/cases/${created.id}`).set('authorization', bearer(USER.donor));
    expect(donor.status).toBe(200);
    expect(donor.body.case.view).toBe('donor');
    expect(donor.body.case).not.toHaveProperty('description_redacted');

    const supplier = await request(app).get(`/api/v1/cases/${created.id}`).set('authorization', bearer(USER.supplier));
    expect(supplier.body.case).toMatchObject({ view: 'supplier', supplier_wallet_pubkey: WALLET.supplier });
    expect(supplier.body.case).not.toHaveProperty('description_redacted');

    const donorList = await request(app).get('/api/v1/cases').set('authorization', bearer(USER.donor));
    expect(donorList.body.cases.map((c: { id: string }) => c.id)).toEqual([created.id]);
  });
});

describe('PATCH /cases/:id', () => {
  it('lets the volunteer correct fields while submitted and audits the field names', async () => {
    const created = await createCase();
    const res = await request(app)
      .patch(`/api/v1/cases/${created.id}`)
      .set('authorization', bearer(USER.fieldWorker))
      .send({ household_count: 5, requested_items: [{ name: 'drinking_water', quantity: 25, unit: 'litre' }] });
    expect(res.status).toBe(200);
    expect(res.body.case.household_count).toBe(5);
    expect(repo.events.at(-1)).toMatchObject({
      event_type: 'case_fields_corrected',
      event_payload_public: { fields: ['household_count', 'requested_items'] },
    });
  });

  it('rejects status changes and edits after approval', async () => {
    const created = await createApprovedCase();
    const status = await request(app)
      .patch(`/api/v1/cases/${created.id}`)
      .set('authorization', bearer(USER.fieldWorker))
      .send({ application_status: 'completed' });
    expect(status.status).toBe(400);
    const late = await request(app)
      .patch(`/api/v1/cases/${created.id}`)
      .set('authorization', bearer(USER.fieldWorker))
      .send({ household_count: 9 });
    expect(late.status).toBe(409);
  });
});

describe('review workflow', () => {
  it('requires the case to be submitted for review first', async () => {
    const created = await createCase();
    const res = await request(app)
      .post(`/api/v1/cases/${created.id}/review`)
      .set('authorization', bearer(USER.reviewer))
      .send(approvalBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('forbids field workers and other organizations from reviewing', async () => {
    const created = await createCase();
    await request(app).post(`/api/v1/cases/${created.id}/submit`).set('authorization', bearer(USER.fieldWorker)).expect(200);
    const fieldWorker = await request(app)
      .post(`/api/v1/cases/${created.id}/review`)
      .set('authorization', bearer(USER.fieldWorker))
      .send(approvalBody);
    expect(fieldWorker.status).toBe(403);
    const other = await request(app)
      .post(`/api/v1/cases/${created.id}/review`)
      .set('authorization', bearer(USER.otherReviewer))
      .send(approvalBody);
    expect(other.status).toBe(404);
  });

  it('approves with escrow terms, audits once and keeps the note private', async () => {
    const created = await createApprovedCase();
    const stored = repo.cases.get(created.id)!;
    expect(stored).toMatchObject({
      application_status: 'approved',
      approved_amount_base_units: '25000000',
      assigned_supplier_organization_id: ORG.supplier,
      supplier_wallet_pubkey: WALLET.supplier,
      escrow_expires_at: '2026-11-08T12:00:00.000Z',
    });

    const repeat = await request(app)
      .post(`/api/v1/cases/${created.id}/review`)
      .set('authorization', bearer(USER.reviewer))
      .send(approvalBody);
    expect(repeat.status).toBe(409);
    expect(repo.events.filter((e) => e.event_type === 'case_reviewed')).toHaveLength(1);

    const reviewerView = await request(app).get(`/api/v1/cases/${created.id}/timeline`).set('authorization', bearer(USER.reviewer));
    const fieldView = await request(app).get(`/api/v1/cases/${created.id}/timeline`).set('authorization', bearer(USER.fieldWorker));
    const note = (body: { timeline: { event_type: string; internal_note: string | null }[] }) =>
      body.timeline.find((e) => e.event_type === 'case_reviewed')?.internal_note;
    expect(note(reviewerView.body)).toBe(approvalBody.review_note);
    expect(note(fieldView.body)).toBeNull();
  });

  it('rejects approval with an unregistered supplier wallet or bad expiry', async () => {
    const created = await createCase();
    await request(app).post(`/api/v1/cases/${created.id}/submit`).set('authorization', bearer(USER.fieldWorker)).expect(200);
    const review = (body: object) =>
      request(app).post(`/api/v1/cases/${created.id}/review`).set('authorization', bearer(USER.reviewer)).send(body);

    expect((await review({ ...approvalBody, supplier_wallet_pubkey: WALLET.donor })).status).toBe(422);
    expect((await review({ ...approvalBody, expires_at: '2026-11-07T12:05:00Z' })).status).toBe(422);
    expect((await review({ ...approvalBody, expires_at: '2027-06-01T00:00:00Z' })).status).toBe(422);
    expect(repo.cases.get(created.id)!.application_status).toBe('under_review');
  });

  it('flags a case without escrow terms', async () => {
    const created = await createCase();
    await request(app).post(`/api/v1/cases/${created.id}/submit`).set('authorization', bearer(USER.fieldWorker)).expect(200);
    const res = await request(app)
      .post(`/api/v1/cases/${created.id}/review`)
      .set('authorization', bearer(USER.reviewer))
      .send({ decision: 'flag', reason_code: 'possible_duplicate' });
    expect(res.status).toBe(200);
    expect(res.body.case.application_status).toBe('flagged');
  });
});

describe('suppliers', () => {
  it('lists supplier wallets for reviewers only', async () => {
    const reviewer = await request(app).get('/api/v1/suppliers').set('authorization', bearer(USER.reviewer));
    expect(reviewer.body.suppliers).toEqual([
      { organization_id: ORG.supplier, name: 'Demo Supplier', wallet_pubkeys: [WALLET.supplier] },
    ]);
    expect((await request(app).get('/api/v1/suppliers').set('authorization', bearer(USER.fieldWorker))).status).toBe(403);
  });
});

describe('GET /public/cases/:publicRef', () => {
  it('does not expose cases before approval', async () => {
    const created = await createCase();
    expect((await request(app).get(`/api/v1/public/cases/${created.public_ref}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/public/cases/not-a-ref')).status).toBe(404);
  });

  it('returns only allowlisted fields and events for approved cases', async () => {
    const created = await createApprovedCase();
    const res = await request(app).get(`/api/v1/public/cases/${created.public_ref}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.case).sort()).toEqual(
      [
        'application_status',
        'approved_amount_base_units',
        'category',
        'created_at',
        'locality_label',
        'public_ref',
        'token_decimals',
        'view',
      ].sort(),
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(approvalBody.review_note);
    expect(serialized).not.toContain(created.id);
    expect(res.body.timeline).toEqual([expect.objectContaining({ event_type: 'case_reviewed', status: 'approved' })]);
  });
});
