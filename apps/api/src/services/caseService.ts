import { createHash, randomBytes } from 'node:crypto';
import {
  canTransition,
  EDITABLE_STATUSES,
  PUBLIC_STATUSES,
  type ApplicationStatus,
  type CaseView,
  type CreateCaseInput,
  type ListCasesQuery,
  type ReviewCaseInput,
  type UpdateCaseInput,
} from '@reliefmesh/shared';
import type { AuthContext, CaseRecord, Membership } from '../domain/types';
import { ApiError } from '../http/errors';
import {
  UniqueViolationError,
  type ApprovalTerms,
  type NewEvent,
  type Repository,
} from '../repositories/repository';
import {
  findOrgMembership,
  hasAnyRole,
  INTAKE_ROLES,
  orgIdsWithRole,
  requireOrgRole,
  REVIEW_ROLES,
  STAFF_ROLES,
} from './authorization';
import { redactContactDetails } from './redaction';
import {
  donorCaseView,
  publicCaseView,
  publicTimelineView,
  staffCaseView,
  staffTimelineView,
  supplierCaseView,
} from './views';

const MIN_ESCROW_MS = 10 * 60 * 1000;
const MAX_ESCROW_MS = 90 * 24 * 60 * 60 * 1000;

const DECISION_TARGET = {
  approve: 'approved',
  needs_information: 'needs_information',
  flag: 'flagged',
  reject: 'rejected',
} as const satisfies Record<ReviewCaseInput['decision'], ApplicationStatus>;

export interface MutationResult {
  caseRecord: CaseRecord;
  eventId: string | null;
}

/** Opaque on-chain case reference: SHA-256 of random bytes, never of personal data (ADR-016). */
function newCaseRefHash(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex');
}

export class CaseService {
  constructor(
    private readonly repo: Repository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async me(auth: AuthContext) {
    return { profile: await this.repo.getProfile(auth.userId), memberships: auth.memberships };
  }

  async listSuppliers(auth: AuthContext) {
    if (!hasAnyRole(auth, REVIEW_ROLES)) throw new ApiError('FORBIDDEN', 'Only NGO reviewers can list suppliers.');
    return this.repo.listSupplierOrganizations();
  }

  async createCase(
    auth: AuthContext,
    input: CreateCaseInput,
    idempotencyKey?: string,
  ): Promise<MutationResult & { created: boolean }> {
    const actor = requireOrgRole(
      auth,
      input.organization_id,
      INTAKE_ROLES,
      'You cannot submit requests for this organization.',
    );

    if (idempotencyKey) {
      const existing = await this.repo.findCaseByClientRequestId(idempotencyKey);
      if (existing) return this.replayCreate(auth, existing);
    }

    let created: CaseRecord;
    try {
      created = await this.repo.insertCase({
        organization_id: input.organization_id,
        created_by: auth.userId,
        category: input.category_hint ?? 'other',
        description_redacted: redactContactDetails(input.description),
        locality_label: input.locality_label,
        requested_items: input.requested_items ?? [],
        requested_amount_base_units: input.requested_amount_base_units,
        token_decimals: input.token_decimals,
        case_ref_hash: newCaseRefHash(),
        client_request_id: idempotencyKey ?? null,
      });
    } catch (err) {
      // A concurrent retry with the same key won the insert.
      if (err instanceof UniqueViolationError && idempotencyKey) {
        const existing = await this.repo.findCaseByClientRequestId(idempotencyKey);
        if (existing) return this.replayCreate(auth, existing);
      }
      throw err;
    }

    const eventId = await this.repo.insertEvent(
      this.event(created, auth, actor, 'case_created', { category: created.category }),
    );
    return { caseRecord: created, eventId, created: true };
  }

  async listCases(auth: AuthContext, query: ListCasesQuery): Promise<CaseView[]> {
    const staffOrgs = orgIdsWithRole(auth, STAFF_ROLES);
    if (query.organization_id && !staffOrgs.includes(query.organization_id)) {
      throw new ApiError('FORBIDDEN', 'You are not a member of that organization.');
    }
    const shared = {
      category: query.category,
      limit: query.limit,
      before: query.cursor,
    };

    const owned = await this.repo.listCases({
      ...shared,
      organizationIds: query.organization_id ? [query.organization_id] : staffOrgs,
      supplierOrganizationIds: query.organization_id ? [] : orgIdsWithRole(auth, ['supplier']),
      statuses: query.status ? [query.status] : undefined,
    });

    const isDonor = orgIdsWithRole(auth, ['donor']).length > 0;
    const publicStatuses = query.status
      ? PUBLIC_STATUSES.filter((s) => s === query.status)
      : PUBLIC_STATUSES;
    const fundable =
      isDonor && !query.organization_id && publicStatuses.length > 0
        ? await this.repo.listCases({
            ...shared,
            organizationIds: [],
            supplierOrganizationIds: [],
            allOrganizations: true,
            statuses: publicStatuses,
          })
        : [];

    const byId = new Map<string, CaseRecord>();
    for (const c of [...owned, ...fundable]) byId.set(c.id, c);
    return [...byId.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, query.limit)
      .flatMap((c) => this.viewFor(auth, c) ?? []);
  }

  async getCaseDetail(auth: AuthContext, caseId: string) {
    const { caseRecord, view } = await this.loadVisible(auth, caseId);
    return { case: view, timeline: await this.timelineFor(auth, caseRecord) };
  }

  async getTimeline(auth: AuthContext, caseId: string) {
    const { caseRecord } = await this.loadVisible(auth, caseId);
    return this.timelineFor(auth, caseRecord);
  }

  async updateCase(auth: AuthContext, caseId: string, patch: UpdateCaseInput): Promise<MutationResult> {
    const { caseRecord } = await this.loadVisible(auth, caseId);
    const actor = requireOrgRole(
      auth,
      caseRecord.organization_id,
      INTAKE_ROLES,
      'Only field volunteers of the owning organization can edit this request.',
    );
    if (!EDITABLE_STATUSES.includes(caseRecord.application_status)) {
      throw new ApiError('INVALID_TRANSITION', `A ${caseRecord.application_status} case can no longer be edited.`);
    }
    const updated = await this.repo.updateCaseFields(caseId, EDITABLE_STATUSES, patch);
    if (!updated) throw new ApiError('INVALID_TRANSITION', 'Case is no longer editable; reload and retry.');
    const eventId = await this.repo.insertEvent(
      this.event(updated, auth, actor, 'case_fields_corrected', { fields: Object.keys(patch).sort() }),
    );
    return { caseRecord: updated, eventId };
  }

  async submitForReview(auth: AuthContext, caseId: string): Promise<MutationResult> {
    const { caseRecord } = await this.loadVisible(auth, caseId);
    const actor = requireOrgRole(
      auth,
      caseRecord.organization_id,
      STAFF_ROLES,
      'Only staff of the owning organization can submit this case for review.',
    );
    return this.transition(caseRecord, 'under_review', auth, actor, 'case_submitted_for_review');
  }

  async reviewCase(auth: AuthContext, caseId: string, input: ReviewCaseInput): Promise<MutationResult> {
    const { caseRecord } = await this.loadVisible(auth, caseId);
    const actor = requireOrgRole(
      auth,
      caseRecord.organization_id,
      REVIEW_ROLES,
      'Only NGO reviewers of the owning organization can review this case.',
    );
    if (caseRecord.application_status !== 'under_review') {
      throw new ApiError('INVALID_TRANSITION', 'Only cases under review can receive a review decision.');
    }
    const approval = input.decision === 'approve' ? await this.validateApproval(input) : null;
    return this.transition(caseRecord, DECISION_TARGET[input.decision], auth, actor, 'case_reviewed', {
      payload: { decision: input.decision, reason_code: input.reason_code },
      internalNote: input.review_note ?? null,
      approval,
    });
  }

  async getPublicCase(publicRef: string) {
    const caseRecord = await this.repo.getCaseByPublicRef(publicRef);
    if (!caseRecord || !PUBLIC_STATUSES.includes(caseRecord.application_status)) {
      throw new ApiError('NOT_FOUND', 'Case not found.');
    }
    return {
      case: publicCaseView(caseRecord),
      timeline: publicTimelineView(await this.repo.listEvents(caseRecord.id)),
    };
  }

  /** Returns the projection the caller may see, or null when the case is not visible to them. */
  private viewFor(auth: AuthContext, c: CaseRecord): CaseView | null {
    if (findOrgMembership(auth, c.organization_id, STAFF_ROLES)) return staffCaseView(c);
    if (findOrgMembership(auth, c.assigned_supplier_organization_id, ['supplier'])) return supplierCaseView(c);
    if (hasAnyRole(auth, ['donor']) && PUBLIC_STATUSES.includes(c.application_status)) return donorCaseView(c);
    return null;
  }

  private async loadVisible(auth: AuthContext, caseId: string) {
    const caseRecord = await this.repo.getCase(caseId);
    const view = caseRecord && this.viewFor(auth, caseRecord);
    // Absent and not-visible are indistinguishable to the caller.
    if (!caseRecord || !view) throw new ApiError('NOT_FOUND', 'Case not found.');
    return { caseRecord, view };
  }

  private async timelineFor(auth: AuthContext, c: CaseRecord) {
    const events = await this.repo.listEvents(c.id);
    if (findOrgMembership(auth, c.organization_id, STAFF_ROLES)) {
      return staffTimelineView(events, Boolean(findOrgMembership(auth, c.organization_id, REVIEW_ROLES)));
    }
    return publicTimelineView(events);
  }

  private async transition(
    c: CaseRecord,
    to: ApplicationStatus,
    auth: AuthContext,
    actor: Membership,
    eventType: string,
    extra: Pick<NewEvent, 'payload' | 'internalNote'> & { approval?: ApprovalTerms | null } = {},
  ): Promise<MutationResult> {
    if (!canTransition(c.application_status, to)) {
      throw new ApiError('INVALID_TRANSITION', `A ${c.application_status} case cannot move to ${to}.`);
    }
    const eventId = await this.repo.transitionCase({
      ...this.event(c, auth, actor, eventType, extra.payload),
      internalNote: extra.internalNote ?? null,
      from: c.application_status,
      to,
      approval: extra.approval ?? null,
    });
    if (!eventId) throw new ApiError('INVALID_TRANSITION', 'Case status changed meanwhile; reload and retry.');
    const updated = await this.repo.getCase(c.id);
    if (!updated) throw new ApiError('NOT_FOUND', 'Case not found.');
    return { caseRecord: updated, eventId };
  }

  private async validateApproval(input: Extract<ReviewCaseInput, { decision: 'approve' }>): Promise<ApprovalTerms> {
    const supplier = (await this.repo.listSupplierOrganizations()).find(
      (s) => s.organization_id === input.supplier_organization_id,
    );
    if (!supplier) throw new ApiError('UNPROCESSABLE', 'Supplier organization not found.');
    if (!supplier.wallet_pubkeys.includes(input.supplier_wallet_pubkey)) {
      throw new ApiError('UNPROCESSABLE', 'Supplier wallet is not registered to that supplier organization.');
    }
    const expiresAt = new Date(input.expires_at);
    const now = this.now().getTime();
    if (expiresAt.getTime() < now + MIN_ESCROW_MS) {
      throw new ApiError('UNPROCESSABLE', 'Escrow expiry must be at least 10 minutes in the future.');
    }
    if (expiresAt.getTime() > now + MAX_ESCROW_MS) {
      throw new ApiError('UNPROCESSABLE', 'Escrow expiry must be within 90 days.');
    }
    return {
      approved_amount_base_units: input.target_amount_base_units,
      escrow_expires_at: expiresAt.toISOString(),
      assigned_supplier_organization_id: supplier.organization_id,
      supplier_wallet_pubkey: input.supplier_wallet_pubkey,
    };
  }

  private replayCreate(auth: AuthContext, existing: CaseRecord): MutationResult & { created: boolean } {
    if (existing.created_by !== auth.userId) {
      throw new ApiError('CONFLICT', 'Idempotency-Key was already used for a different request.');
    }
    return { caseRecord: existing, eventId: null, created: false };
  }

  private event(
    c: CaseRecord,
    auth: AuthContext,
    actor: Membership,
    eventType: string,
    payload: Record<string, unknown> = {},
  ): NewEvent {
    return { caseId: c.id, actorUserId: auth.userId, actorRole: actor.role, eventType, payload };
  }
}
