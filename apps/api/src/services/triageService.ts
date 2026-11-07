import { createHash } from 'node:crypto';
import {
  duplicateResponseSchema,
  intakeResponseSchema,
  type AiStatus,
  type ApplicationStatus,
  type CaseAiPanel,
  type TriageResponse,
} from '@reliefmesh/shared';
import { AiUnavailableError, type AiClient, type CaseSummary } from '../ai/aiClient';
import type { AuthContext, CaseRecord } from '../domain/types';
import { ApiError } from '../http/errors';
import type { AssessmentRecord, Repository } from '../repositories/repository';
import { findOrgMembership, STAFF_ROLES } from './authorization';

const TRIAGE_STATUSES: readonly ApplicationStatus[] = ['submitted', 'needs_information', 'under_review'];
const POOL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const POOL_LIMIT = 20;
const AI_ACTOR = 'ai_service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function summarize(c: CaseRecord): CaseSummary {
  return {
    case_id: c.id,
    description: c.description_redacted,
    locality_label: c.locality_label,
    category: c.category,
    household_count: c.household_count,
    requested_items: c.requested_items,
    submitted_at: c.created_at,
  };
}

/**
 * Orchestrates the bounded AI assistants (AI_AGENTS.md §6). It records suggestions only:
 * it never changes application status, eligibility or anything on-chain.
 */
export class TriageService {
  constructor(
    private readonly repo: Repository,
    private readonly ai: AiClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async triage(auth: AuthContext, caseId: string): Promise<TriageResponse> {
    const c = await this.repo.getCase(caseId);
    if (!c || !findOrgMembership(auth, c.organization_id, STAFF_ROLES)) {
      throw new ApiError('NOT_FOUND', 'Case not found.');
    }
    if (!TRIAGE_STATUSES.includes(c.application_status)) {
      throw new ApiError('INVALID_TRANSITION', 'AI triage is only available before a review decision.');
    }
    return this.run(c);
  }

  /** Used right after a case is saved: never throws, so the saved request is never lost. */
  async runAfterCreate(c: CaseRecord): Promise<TriageResponse | null> {
    try {
      return await this.run(c);
    } catch {
      return null;
    }
  }

  async panel(c: CaseRecord, assessments?: AssessmentRecord[]): Promise<CaseAiPanel> {
    const list = assessments ?? (await this.repo.listAssessments(c.id));
    const intakeRecord = list.find((a) => a.agent_type === 'intake');
    const duplicateRecord = list.find((a) => a.agent_type === 'duplicate');
    const intake = intakeRecord && intakeResponseSchema.safeParse(intakeRecord.output);
    const duplicates = duplicateRecord && duplicateResponseSchema.safeParse(duplicateRecord.output);

    const candidates = duplicates?.success
      ? await Promise.all(
          duplicates.data.candidates.map(async (candidate) => ({
            ...candidate,
            public_ref: (await this.repo.getCase(candidate.case_id))?.public_ref ?? null,
          })),
        )
      : [];

    return {
      ai_status: c.ai_status,
      intake:
        intakeRecord && intake?.success
          ? {
              assessment_id: intakeRecord.id,
              provider: intake.data.provider,
              model_version: intake.data.model_version,
              needs_review: intake.data.needs_review,
              result: intake.data.result,
              created_at: intakeRecord.created_at,
            }
          : null,
      duplicates:
        duplicateRecord && duplicates?.success
          ? {
              assessment_id: duplicateRecord.id,
              candidates,
              disclaimer: duplicates.data.disclaimer,
              method: duplicates.data.method,
              created_at: duplicateRecord.created_at,
            }
          : null,
    };
  }

  private async run(c: CaseRecord): Promise<TriageResponse> {
    const intakeInput = {
      case_id: c.id,
      description: c.description_redacted,
      locality_label: c.locality_label,
      submitted_at: c.created_at,
    };
    const fingerprint = sha256(JSON.stringify([intakeInput.description, intakeInput.locality_label]));
    const existing = await this.repo.listAssessments(c.id);
    const latestIntake = existing.find((a) => a.agent_type === 'intake');
    if (latestIntake?.input_fingerprint === fingerprint && (c.ai_status === 'completed' || c.ai_status === 'needs_review')) {
      return this.response(c, existing); // same input already assessed: idempotent
    }

    let intake;
    let duplicates;
    let pool: CaseRecord[];
    try {
      intake = await this.ai.intake(intakeInput);
      const since = new Date(this.now().getTime() - POOL_WINDOW_MS).toISOString();
      pool = await this.repo.listDuplicatePool(c.organization_id, c.id, since, POOL_LIMIT);
      duplicates = await this.ai.duplicates({
        case: {
          ...summarize(c),
          category: intake.result.category,
          household_count: intake.result.household_count,
          requested_items: intake.result.requested_items,
        },
        candidates: pool.map(summarize),
      });
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      await this.repo.updateCaseAi(c.id, { ai_status: 'unavailable' });
      await this.repo.insertEvent({ caseId: c.id, actorUserId: null, actorRole: AI_ACTOR, eventType: 'ai_triage_unavailable' });
      return this.response({ ...c, ai_status: 'unavailable' }, existing);
    }

    const intakeId = await this.repo.insertAssessment({
      case_id: c.id,
      agent_type: 'intake',
      model_provider: intake.provider,
      model_version: intake.model_version,
      input_fingerprint: fingerprint,
      output: intake,
      confidence: intake.result.confidence,
    });
    const duplicateId = await this.repo.insertAssessment({
      case_id: c.id,
      agent_type: 'duplicate',
      model_provider: 'reliefmesh',
      model_version: duplicates.method,
      input_fingerprint: sha256(JSON.stringify([fingerprint, ...pool.map((p) => p.id)])),
      output: duplicates,
      confidence: null,
    });

    const aiStatus: AiStatus = intake.needs_review ? 'needs_review' : 'completed';
    await this.repo.updateCaseAi(c.id, { ai_status: aiStatus, urgency_suggestion: intake.result.urgency_suggestion });
    await this.repo.insertEvent({
      caseId: c.id,
      actorUserId: null,
      actorRole: AI_ACTOR,
      eventType: 'ai_triage_completed',
      payload: {
        intake_assessment_id: intakeId,
        duplicate_assessment_id: duplicateId,
        confidence: intake.result.confidence,
        possible_duplicates: duplicates.candidates.length,
      },
    });
    return this.response({ ...c, ai_status: aiStatus }, await this.repo.listAssessments(c.id));
  }

  private async response(c: CaseRecord, assessments: AssessmentRecord[]): Promise<TriageResponse> {
    const ai = await this.panel(c, assessments);
    return {
      ai_status: c.ai_status,
      human_review_required: true,
      intake_assessment_id: ai.intake?.assessment_id ?? null,
      duplicate_assessment_id: ai.duplicates?.assessment_id ?? null,
      ai,
    };
  }
}
