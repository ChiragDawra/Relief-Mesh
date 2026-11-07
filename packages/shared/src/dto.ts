/** API response contracts shared by apps/api (producer) and apps/web (consumer). */
import type { CaseAiPanel, TriageResponse } from './ai';
import type {
  AiStatus,
  ApplicationStatus,
  CaseCategory,
  OrganizationType,
  Role,
  Urgency,
} from './enums';
import type { RequestedItem } from './schemas';

/** Row of public.relief_cases. Base-unit amounts are decimal strings. */
export interface CaseRecord {
  id: string;
  public_ref: string;
  organization_id: string;
  created_by: string | null;
  category: CaseCategory;
  description_redacted: string;
  locality_label: string;
  household_count: number | null;
  requested_items: RequestedItem[];
  requested_amount_base_units: string;
  token_decimals: number;
  urgency_suggestion: Urgency | null;
  urgency_human_override: Urgency | null;
  application_status: ApplicationStatus;
  ai_status: AiStatus;
  assigned_supplier_organization_id: string | null;
  supplier_wallet_pubkey: string | null;
  approved_amount_base_units: string | null;
  escrow_expires_at: string | null;
  case_ref_hash: string;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffCase extends CaseRecord {
  view: 'staff';
}

export interface SupplierCase
  extends Pick<
    CaseRecord,
    | 'id'
    | 'public_ref'
    | 'category'
    | 'locality_label'
    | 'requested_items'
    | 'approved_amount_base_units'
    | 'token_decimals'
    | 'application_status'
    | 'escrow_expires_at'
    | 'supplier_wallet_pubkey'
    | 'created_at'
  > {
  view: 'supplier';
}

export interface PublicCase
  extends Pick<
    CaseRecord,
    | 'public_ref'
    | 'category'
    | 'locality_label'
    | 'application_status'
    | 'approved_amount_base_units'
    | 'token_decimals'
    | 'created_at'
  > {
  view: 'public';
}

export interface DonorCase extends Omit<PublicCase, 'view'>, Pick<CaseRecord, 'id' | 'escrow_expires_at'> {
  view: 'donor';
}

export type CaseView = StaffCase | SupplierCase | DonorCase;

export type ActorKind = 'human' | 'ai' | 'chain';

export interface TimelineEntry {
  id: string;
  event_type: string;
  actor_kind: ActorKind;
  actor_role: string;
  payload: Record<string, unknown>;
  transaction_signature: string | null;
  internal_note: string | null;
  created_at: string;
}

export interface PublicTimelineEntry {
  event_type: string;
  actor_kind: ActorKind;
  status: string | null;
  transaction_signature: string | null;
  created_at: string;
}

export interface Membership {
  organization_id: string;
  organization_name: string;
  organization_type: OrganizationType;
  role: Role;
  wallet_pubkey: string | null;
}

export interface MeResponse {
  profile: { id: string; display_name: string | null; default_wallet_pubkey: string | null } | null;
  memberships: Membership[];
}

export interface SupplierOrganization {
  organization_id: string;
  name: string;
  wallet_pubkeys: string[];
}

export interface MutationResponse {
  case: StaffCase;
  audit_event_id: string | null;
  /** Present on case creation: AI runs after the case is saved; null if it could not run. */
  triage?: TriageResponse | null;
}

export interface CaseDetailResponse {
  case: CaseView;
  timeline: TimelineEntry[] | PublicTimelineEntry[];
  /** Staff of the owning organization only. */
  ai?: CaseAiPanel;
}

export interface PublicCaseResponse {
  case: PublicCase;
  timeline: PublicTimelineEntry[];
}
