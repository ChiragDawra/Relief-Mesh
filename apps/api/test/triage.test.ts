import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { approvalBody, bearer, buildTestApp, newCaseBody, USER } from './support/fixtures';
import type { FakeAiClient } from './support/fakeAi';
import type { MemoryRepository } from './support/memoryRepository';

let app: ReturnType<typeof buildTestApp>['app'];
let repo: MemoryRepository;
let ai: FakeAiClient;

beforeEach(() => {
  ({ app, repo, ai } = buildTestApp());
});

const create = () => request(app).post('/api/v1/cases').set('authorization', bearer(USER.fieldWorker)).send(newCaseBody);
const triage = (caseId: string, user: string = USER.fieldWorker) =>
  request(app).post(`/api/v1/cases/${caseId}/triage`).set('authorization', bearer(user));

describe('triage on case creation', () => {
  it('saves the case first, then records AI suggestions without changing status', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.case).toMatchObject({ application_status: 'submitted', ai_status: 'completed', urgency_suggestion: 'high' });
    expect(res.body.triage).toMatchObject({ ai_status: 'completed', human_review_required: true });
    expect(res.body.triage.ai.intake.result.household_count).toBe(5);

    expect(repo.assessments.map((a) => a.agent_type).sort()).toEqual(['duplicate', 'intake']);
    expect(repo.events.at(-1)).toMatchObject({ event_type: 'ai_triage_completed', actor_role: 'ai_service', actor_user_id: null });
  });

  it('sends minimized, redacted input to the AI service', async () => {
    await create();
    const [sent] = ai.intakeCalls;
    expect(Object.keys(sent!).sort()).toEqual(['case_id', 'description', 'locality_label', 'submitted_at']);
    expect(sent!.description).not.toContain('555');
  });

  it('keeps the case and falls back to manual review when AI is down', async () => {
    ai.available = false;
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.case.ai_status).toBe('unavailable');
    expect(repo.cases.size).toBe(1);
    expect(repo.events.map((e) => e.event_type)).toEqual(['case_created', 'ai_triage_unavailable']);

    ai.available = true;
    const retry = await triage(res.body.case.id);
    expect(retry.status).toBe(200);
    expect(retry.body.ai_status).toBe('completed');
  });
});

describe('POST /cases/:id/triage', () => {
  it('is idempotent for unchanged input', async () => {
    const { body } = await create();
    await triage(body.case.id).expect(200);
    await triage(body.case.id).expect(200);
    expect(ai.intakeCalls).toHaveLength(1);
    expect(repo.assessments).toHaveLength(2);
  });

  it('suggests same-organization duplicates with a public reference, never merging them', async () => {
    const first = (await create()).body.case;
    const second = (await create()).body;
    const candidates = second.triage.ai.duplicates.candidates;
    expect(candidates).toEqual([expect.objectContaining({ case_id: first.id, public_ref: first.public_ref })]);
    expect(ai.duplicateCalls.at(-1)!.candidates.map((c) => c.case_id)).toEqual([first.id]);
    expect(repo.cases.get(first.id)!.application_status).toBe('submitted');
    expect(repo.cases.get(second.case.id)!.application_status).toBe('submitted');
  });

  it('is unavailable after a review decision', async () => {
    const { body } = await create();
    await request(app).post(`/api/v1/cases/${body.case.id}/submit`).set('authorization', bearer(USER.fieldWorker)).expect(200);
    await request(app)
      .post(`/api/v1/cases/${body.case.id}/review`)
      .set('authorization', bearer(USER.reviewer))
      .send(approvalBody)
      .expect(200);
    expect((await triage(body.case.id)).status).toBe(409);
  });

  it('hides AI assessments from non-staff', async () => {
    const { body } = await create();
    expect((await triage(body.case.id, USER.supplier)).status).toBe(404);
    expect((await triage(body.case.id, USER.otherReviewer)).status).toBe(404);

    const staff = await request(app).get(`/api/v1/cases/${body.case.id}`).set('authorization', bearer(USER.reviewer));
    expect(staff.body.ai.intake.provider).toBe('mock');
  });

  it('rate-limits repeated AI requests per user', async () => {
    const { body } = await create();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await triage(body.case.id)).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
