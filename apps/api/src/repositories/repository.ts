import type { ApplicationStatus, CaseCategory } from '@reliefmesh/shared';
import type { CaseEvent, CaseRecord, Membership, Profile, SupplierOrganization } from '../domain/types';

export type NewCase = Pick<
  CaseRecord,
  | 'organization_id'
  | 'created_by'
  | 'category'
  | 'description_redacted'
  | 'locality_label'
  | 'requested_items'
  | 'requested_amount_base_units'
  | 'token_decimals'
  | 'case_ref_hash'
  | 'client_request_id'
>;

export type EditableCaseFields = Partial<
  Pick<
    CaseRecord,
    | 'category'
    | 'household_count'
    | 'requested_items'
    | 'locality_label'
    | 'requested_amount_base_units'
    | 'urgency_human_override'
  >
>;

export interface CaseQuery {
  /** Cases owned by these organizations. */
  organizationIds: string[];
  /** Cases assigned to these supplier organizations. */
  supplierOrganizationIds: string[];
  /** Ignore ownership and match every organization (callers must return public projections only). */
  allOrganizations?: boolean;
  statuses?: readonly ApplicationStatus[];
  category?: CaseCategory;
  limit: number;
  /** Return cases created strictly before this ISO timestamp (cursor pagination). */
  before?: string;
}

export interface ApprovalTerms {
  approved_amount_base_units: string;
  escrow_expires_at: string;
  assigned_supplier_organization_id: string;
  supplier_wallet_pubkey: string;
}

export interface NewEvent {
  caseId: string;
  actorUserId: string | null;
  actorRole: string;
  eventType: string;
  payload?: Record<string, unknown>;
  transactionSignature?: string | null;
  internalNote?: string | null;
}

export interface TransitionInput extends NewEvent {
  from: ApplicationStatus;
  to: ApplicationStatus;
  approval?: ApprovalTerms | null;
}

export class UniqueViolationError extends Error {}

export interface Repository {
  getProfile(userId: string): Promise<Profile | null>;
  listMemberships(userId: string): Promise<Membership[]>;
  listSupplierOrganizations(): Promise<SupplierOrganization[]>;

  /** Throws UniqueViolationError when client_request_id was already used. */
  insertCase(input: NewCase): Promise<CaseRecord>;
  findCaseByClientRequestId(clientRequestId: string): Promise<CaseRecord | null>;
  getCase(caseId: string): Promise<CaseRecord | null>;
  getCaseByPublicRef(publicRef: string): Promise<CaseRecord | null>;
  listCases(query: CaseQuery): Promise<CaseRecord[]>;
  /** Applies the patch only while the case is in one of `expectedStatuses`; null otherwise. */
  updateCaseFields(
    caseId: string,
    expectedStatuses: readonly ApplicationStatus[],
    fields: EditableCaseFields,
  ): Promise<CaseRecord | null>;

  /** Compare-and-set status change plus audit event; null when the status no longer equals `from`. */
  transitionCase(input: TransitionInput): Promise<string | null>;
  insertEvent(input: NewEvent): Promise<string>;
  listEvents(caseId: string): Promise<CaseEvent[]>;
}
