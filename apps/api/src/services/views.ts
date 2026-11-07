import {
  PUBLIC_STATUSES,
  type ActorKind,
  type ApplicationStatus,
  type CaseRecord,
  type DonorCase,
  type PublicCase,
  type PublicTimelineEntry,
  type StaffCase,
  type SupplierCase,
  type TimelineEntry,
} from '@reliefmesh/shared';
import type { CaseEvent } from '../domain/types';

/** Full record for staff of the owning organization. */
export function staffCaseView(c: CaseRecord): StaffCase {
  return { view: 'staff', ...c };
}

/** What an assigned supplier needs to fulfil the order: no request text or household details. */
export function supplierCaseView(c: CaseRecord): SupplierCase {
  return {
    view: 'supplier',
    id: c.id,
    public_ref: c.public_ref,
    category: c.category,
    locality_label: c.locality_label,
    requested_items: c.requested_items,
    approved_amount_base_units: c.approved_amount_base_units,
    token_decimals: c.token_decimals,
    application_status: c.application_status,
    escrow_expires_at: c.escrow_expires_at,
    supplier_wallet_pubkey: c.supplier_wallet_pubkey,
    created_at: c.created_at,
  };
}

/** Allowlisted public-safe projection (DATA_MODEL §6). */
export function publicCaseView(c: CaseRecord): PublicCase {
  return {
    view: 'public',
    public_ref: c.public_ref,
    category: c.category,
    locality_label: c.locality_label,
    application_status: c.application_status,
    approved_amount_base_units: c.approved_amount_base_units,
    token_decimals: c.token_decimals,
    created_at: c.created_at,
  };
}

/** Donors also need the internal id to fund a case; still no request text. */
export function donorCaseView(c: CaseRecord): DonorCase {
  return { ...publicCaseView(c), view: 'donor', id: c.id, escrow_expires_at: c.escrow_expires_at };
}

export function actorKind(eventType: string): ActorKind {
  if (eventType.startsWith('ai_')) return 'ai';
  if (eventType.startsWith('chain_')) return 'chain';
  return 'human';
}

export function staffTimelineView(events: CaseEvent[], includeInternalNotes: boolean): TimelineEntry[] {
  return events.map((e) => ({
    id: e.id,
    event_type: e.event_type,
    actor_kind: actorKind(e.event_type),
    actor_role: e.actor_role,
    payload: e.event_payload_public,
    transaction_signature: e.transaction_signature,
    internal_note: includeInternalNotes ? e.internal_note : null,
    created_at: e.created_at,
  }));
}

/** Public timeline: chain receipts and moves into public statuses; no payloads, notes or actors. */
export function publicTimelineView(events: CaseEvent[]): PublicTimelineEntry[] {
  return events.flatMap((e) => {
    const to = e.event_payload_public['to'];
    const status = typeof to === 'string' ? to : null;
    const kind = actorKind(e.event_type);
    const isPublic = kind === 'chain' || (status !== null && PUBLIC_STATUSES.includes(status as ApplicationStatus));
    if (!isPublic) return [];
    return [
      {
        event_type: e.event_type,
        actor_kind: kind,
        status,
        transaction_signature: e.transaction_signature,
        created_at: e.created_at,
      },
    ];
  });
}
