import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiStatus, ApplicationStatus, OrganizationType, Role, Urgency } from '@reliefmesh/shared';
import type { CaseEvent, CaseRecord, Membership, Profile, SupplierOrganization } from '../domain/types';
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
} from './repository';

// bigint columns are cast to text so amounts never pass through JS numbers.
const CASE_COLUMNS = [
  'id',
  'public_ref',
  'organization_id',
  'created_by',
  'category',
  'description_redacted',
  'locality_label',
  'household_count',
  'requested_items',
  'requested_amount_base_units::text',
  'token_decimals',
  'urgency_suggestion',
  'urgency_human_override',
  'application_status',
  'ai_status',
  'assigned_supplier_organization_id',
  'supplier_wallet_pubkey',
  'approved_amount_base_units::text',
  'escrow_expires_at',
  'case_ref_hash',
  'client_request_id',
  'created_at',
  'updated_at',
].join(',');

const EVENT_COLUMNS =
  'id, case_id, actor_user_id, actor_role, event_type, event_payload_public, transaction_signature, internal_note, created_at';

interface DbResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) {
    if (error.code === '23505') throw new UniqueViolationError(error.message);
    throw new Error(`Database error: ${error.message}`);
  }
  return data as T;
}

interface MembershipRow {
  organization_id: string;
  role: Role;
  wallet_pubkey: string | null;
  organizations: { name: string; organization_type: OrganizationType };
}

interface SupplierRow {
  id: string;
  name: string;
  memberships: { role: Role; wallet_pubkey: string | null }[];
}

export class SupabaseRepository implements Repository {
  constructor(private readonly db: SupabaseClient) {}

  async getProfile(userId: string): Promise<Profile | null> {
    return unwrap(
      await this.db.from('profiles').select('id, display_name, default_wallet_pubkey').eq('id', userId).maybeSingle(),
    );
  }

  async listMemberships(userId: string): Promise<Membership[]> {
    const rows = unwrap<MembershipRow[]>(
      await this.db
        .from('memberships')
        .select('organization_id, role, wallet_pubkey, organizations(name, organization_type)')
        .eq('user_id', userId),
    );
    return rows.map((r) => ({
      organization_id: r.organization_id,
      organization_name: r.organizations.name,
      organization_type: r.organizations.organization_type,
      role: r.role,
      wallet_pubkey: r.wallet_pubkey,
    }));
  }

  async listSupplierOrganizations(): Promise<SupplierOrganization[]> {
    const rows = unwrap<SupplierRow[]>(
      await this.db
        .from('organizations')
        .select('id, name, memberships(role, wallet_pubkey)')
        .eq('organization_type', 'supplier')
        .order('name'),
    );
    return rows.map((o) => ({
      organization_id: o.id,
      name: o.name,
      wallet_pubkeys: [
        ...new Set(
          o.memberships.flatMap((m) => (m.role === 'supplier' && m.wallet_pubkey ? [m.wallet_pubkey] : [])),
        ),
      ],
    }));
  }

  async insertCase(input: NewCase): Promise<CaseRecord> {
    return unwrap(await this.db.from('relief_cases').insert(input).select(CASE_COLUMNS).single());
  }

  async findCaseByClientRequestId(clientRequestId: string): Promise<CaseRecord | null> {
    return unwrap(
      await this.db.from('relief_cases').select(CASE_COLUMNS).eq('client_request_id', clientRequestId).maybeSingle(),
    );
  }

  async getCase(caseId: string): Promise<CaseRecord | null> {
    return unwrap(await this.db.from('relief_cases').select(CASE_COLUMNS).eq('id', caseId).maybeSingle());
  }

  async getCaseByPublicRef(publicRef: string): Promise<CaseRecord | null> {
    return unwrap(await this.db.from('relief_cases').select(CASE_COLUMNS).eq('public_ref', publicRef).maybeSingle());
  }

  async listCases(query: CaseQuery): Promise<CaseRecord[]> {
    let request = this.db
      .from('relief_cases')
      .select(CASE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (!query.allOrganizations) {
      // Organization ids come from verified memberships, never from the client.
      const scopes = [
        query.organizationIds.length ? `organization_id.in.(${query.organizationIds.join(',')})` : null,
        query.supplierOrganizationIds.length
          ? `assigned_supplier_organization_id.in.(${query.supplierOrganizationIds.join(',')})`
          : null,
      ].filter(Boolean);
      if (scopes.length === 0) return [];
      request = request.or(scopes.join(','));
    }
    if (query.statuses) request = request.in('application_status', [...query.statuses]);
    if (query.category) request = request.eq('category', query.category);
    if (query.before) request = request.lt('created_at', query.before);
    return unwrap(await request);
  }

  async updateCaseFields(
    caseId: string,
    expectedStatuses: readonly ApplicationStatus[],
    fields: EditableCaseFields,
  ): Promise<CaseRecord | null> {
    return unwrap(
      await this.db
        .from('relief_cases')
        .update(fields)
        .eq('id', caseId)
        .in('application_status', [...expectedStatuses])
        .select(CASE_COLUMNS)
        .maybeSingle(),
    );
  }

  async transitionCase(input: TransitionInput): Promise<string | null> {
    return unwrap(
      await this.db.rpc('transition_case', {
        p_case_id: input.caseId,
        p_from: input.from,
        p_to: input.to,
        p_actor_user_id: input.actorUserId,
        p_actor_role: input.actorRole,
        p_event_type: input.eventType,
        p_payload: input.payload ?? {},
        p_transaction_signature: input.transactionSignature ?? null,
        p_internal_note: input.internalNote ?? null,
        p_approval: input.approval ?? null,
      }),
    );
  }

  async insertEvent(input: NewEvent): Promise<string> {
    const row = unwrap<{ id: string }>(
      await this.db
        .from('case_events')
        .insert({
          case_id: input.caseId,
          actor_user_id: input.actorUserId,
          actor_role: input.actorRole,
          event_type: input.eventType,
          event_payload_public: input.payload ?? {},
          transaction_signature: input.transactionSignature ?? null,
          internal_note: input.internalNote ?? null,
        })
        .select('id')
        .single(),
    );
    return row.id;
  }

  async insertAssessment(input: NewAssessment): Promise<string> {
    const row = unwrap<{ id: string }>(await this.db.from('ai_assessments').insert(input).select('id').single());
    return row.id;
  }

  async listAssessments(caseId: string): Promise<AssessmentRecord[]> {
    return unwrap(
      await this.db
        .from('ai_assessments')
        .select('id, case_id, agent_type, model_provider, model_version, input_fingerprint, output, confidence, created_at')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(20),
    );
  }

  async updateCaseAi(caseId: string, fields: { ai_status: AiStatus; urgency_suggestion?: Urgency | null }): Promise<void> {
    unwrap(await this.db.from('relief_cases').update(fields).eq('id', caseId));
  }

  async listDuplicatePool(
    organizationId: string,
    excludeCaseId: string,
    since: string,
    limit: number,
  ): Promise<CaseRecord[]> {
    return unwrap(
      await this.db
        .from('relief_cases')
        .select(CASE_COLUMNS)
        .eq('organization_id', organizationId)
        .neq('id', excludeCaseId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit),
    );
  }

  async listEvents(caseId: string): Promise<CaseEvent[]> {
    return unwrap(
      await this.db
        .from('case_events')
        .select(EVENT_COLUMNS)
        .eq('case_id', caseId)
        .order('created_at')
        .order('id'),
    );
  }
}
