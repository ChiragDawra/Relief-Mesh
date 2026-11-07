import type { Membership } from '@reliefmesh/shared';

export type { CaseRecord, Membership, SupplierOrganization } from '@reliefmesh/shared';

/** Verified identity of the caller; roles always come from the database, never the client. */
export interface AuthContext {
  userId: string;
  memberships: Membership[];
}

export interface Profile {
  id: string;
  display_name: string | null;
  default_wallet_pubkey: string | null;
}

/** Row of public.case_events (internal_note is private to NGO reviewers). */
export interface CaseEvent {
  id: string;
  case_id: string;
  actor_user_id: string | null;
  actor_role: string;
  event_type: string;
  event_payload_public: Record<string, unknown>;
  transaction_signature: string | null;
  internal_note: string | null;
  created_at: string;
}
