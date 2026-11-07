import { randomUUID } from 'node:crypto';
import { canTransition, type AiStatus, type ApplicationStatus, type Urgency } from '@reliefmesh/shared';
import type {
  CaseEvent,
  CaseRecord,
  Membership,
  Profile,
  SupplierOrganization,
} from '../../src/domain/types';
import {
  UniqueViolationError,
  type AssessmentRecord,
  type CaseQuery,
  type NewAssessment,
  type EditableCaseFields,
  type NewCase,
  type NewEvent,
  type Repository,
  type TransitionInput,
} from '../../src/repositories/repository';

export interface MemoryDirectory {
  profiles: Profile[];
  memberships: Record<string, Membership[]>;
  suppliers: SupplierOrganization[];
}

/** In-memory Repository with the same compare-and-set semantics as transition_case(). */
export class MemoryRepository implements Repository {
  readonly cases = new Map<string, CaseRecord>();
  readonly events: CaseEvent[] = [];
  readonly assessments: AssessmentRecord[] = [];
  private refSeq = 1001;
  private tick = 0;

  constructor(private readonly directory: MemoryDirectory) {}

  private stamp(): string {
    return new Date(Date.UTC(2026, 10, 7, 12) + this.tick++).toISOString();
  }

  async getProfile(userId: string) {
    return this.directory.profiles.find((p) => p.id === userId) ?? null;
  }

  async listMemberships(userId: string) {
    return this.directory.memberships[userId] ?? [];
  }

  async listSupplierOrganizations() {
    return this.directory.suppliers;
  }

  async insertCase(input: NewCase) {
    const duplicate = [...this.cases.values()].some(
      (c) => input.client_request_id && c.client_request_id === input.client_request_id,
    );
    if (duplicate) throw new UniqueViolationError('client_request_id');
    const at = this.stamp();
    const record: CaseRecord = {
      id: randomUUID(),
      public_ref: `RM-DEMO-${this.refSeq++}`,
      household_count: null,
      urgency_suggestion: null,
      urgency_human_override: null,
      application_status: 'submitted',
      ai_status: 'pending',
      assigned_supplier_organization_id: null,
      supplier_wallet_pubkey: null,
      approved_amount_base_units: null,
      escrow_expires_at: null,
      created_at: at,
      updated_at: at,
      ...input,
    };
    this.cases.set(record.id, record);
    return structuredClone(record);
  }

  async findCaseByClientRequestId(clientRequestId: string) {
    const found = [...this.cases.values()].find((c) => c.client_request_id === clientRequestId);
    return found ? structuredClone(found) : null;
  }

  async getCase(caseId: string) {
    const found = this.cases.get(caseId);
    return found ? structuredClone(found) : null;
  }

  async getCaseByPublicRef(publicRef: string) {
    const found = [...this.cases.values()].find((c) => c.public_ref === publicRef);
    return found ? structuredClone(found) : null;
  }

  async listCases(query: CaseQuery) {
    return [...this.cases.values()]
      .filter(
        (c) =>
          query.allOrganizations ||
          query.organizationIds.includes(c.organization_id) ||
          (c.assigned_supplier_organization_id !== null &&
            query.supplierOrganizationIds.includes(c.assigned_supplier_organization_id)),
      )
      .filter((c) => !query.statuses || query.statuses.includes(c.application_status))
      .filter((c) => !query.category || c.category === query.category)
      .filter((c) => !query.before || c.created_at < query.before)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, query.limit)
      .map((c) => structuredClone(c));
  }

  async updateCaseFields(caseId: string, expected: readonly ApplicationStatus[], fields: EditableCaseFields) {
    const c = this.cases.get(caseId);
    if (!c || !expected.includes(c.application_status)) return null;
    Object.assign(c, fields, { updated_at: this.stamp() });
    return structuredClone(c);
  }

  async transitionCase(input: TransitionInput) {
    if (!canTransition(input.from, input.to)) {
      throw new Error(`transition ${input.from} -> ${input.to} is not allowed`);
    }
    const c = this.cases.get(input.caseId);
    if (!c || c.application_status !== input.from) return null;
    Object.assign(c, input.approval ?? {}, { application_status: input.to, updated_at: this.stamp() });
    return this.insertEvent({ ...input, payload: { ...input.payload, from: input.from, to: input.to } });
  }

  async insertEvent(input: NewEvent) {
    const event: CaseEvent = {
      id: randomUUID(),
      case_id: input.caseId,
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      event_type: input.eventType,
      event_payload_public: input.payload ?? {},
      transaction_signature: input.transactionSignature ?? null,
      internal_note: input.internalNote ?? null,
      created_at: this.stamp(),
    };
    this.events.push(event);
    return event.id;
  }

  async listEvents(caseId: string) {
    return this.events.filter((e) => e.case_id === caseId).map((e) => structuredClone(e));
  }

  async insertAssessment(input: NewAssessment) {
    const record: AssessmentRecord = { ...structuredClone(input), id: randomUUID(), created_at: this.stamp() };
    this.assessments.push(record);
    return record.id;
  }

  async listAssessments(caseId: string) {
    return this.assessments
      .filter((a) => a.case_id === caseId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => structuredClone(a));
  }

  async updateCaseAi(caseId: string, fields: { ai_status: AiStatus; urgency_suggestion?: Urgency | null }) {
    const c = this.cases.get(caseId);
    if (c) Object.assign(c, fields, { updated_at: this.stamp() });
  }

  async listDuplicatePool(organizationId: string, excludeCaseId: string, since: string, limit: number) {
    return [...this.cases.values()]
      .filter((c) => c.organization_id === organizationId && c.id !== excludeCaseId && c.created_at >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((c) => structuredClone(c));
  }
}
