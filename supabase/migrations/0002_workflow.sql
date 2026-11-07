-- ReliefMesh workflow additions (ADR-010, ADR-011, ADR-016).

-- Human-readable, non-identifying case references: RM-DEMO-1001, RM-DEMO-1002, ...
create sequence if not exists public.relief_case_ref_seq start with 1001;
alter sequence public.relief_case_ref_seq owned by public.relief_cases.public_ref;

alter table public.relief_cases
  alter column public_ref set default ('RM-DEMO-' || nextval('public.relief_case_ref_seq'::regclass)::text),
  add column if not exists approved_amount_base_units bigint
    check (approved_amount_base_units is null or approved_amount_base_units > 0),
  add column if not exists escrow_expires_at timestamptz,
  add column if not exists client_request_id uuid unique;

-- A case past approval must carry the complete approved escrow terms.
alter table public.relief_cases add constraint relief_cases_approval_complete check (
  application_status not in ('approved', 'funded', 'delivery_submitted', 'delivery_verified', 'completed')
  or (
    approved_amount_base_units is not null
    and escrow_expires_at is not null
    and assigned_supplier_organization_id is not null
    and supplier_wallet_pubkey is not null
  )
);

-- Private reviewer note; never part of event_payload_public.
alter table public.case_events
  add column if not exists internal_note text check (internal_note is null or length(internal_note) <= 2000);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger relief_cases_touch_updated_at
  before update on public.relief_cases
  for each row execute function public.touch_updated_at();

-- Audit events and AI assessments are immutable snapshots.
create or replace function public.reject_update()
returns trigger
language plpgsql
as $$
begin
  raise exception '% rows are immutable', tg_table_name;
end;
$$;

create trigger case_events_immutable
  before update on public.case_events
  for each row execute function public.reject_update();

create trigger ai_assessments_immutable
  before update on public.ai_assessments
  for each row execute function public.reject_update();

-- Allowed application transitions (PRD §8 + ADR-011). Mirrors packages/shared state machine.
create or replace function public.case_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('submitted', 'needs_information'), ('submitted', 'under_review'), ('submitted', 'flagged'),
    ('needs_information', 'submitted'), ('needs_information', 'under_review'), ('needs_information', 'flagged'),
    ('under_review', 'approved'), ('under_review', 'needs_information'),
    ('under_review', 'flagged'), ('under_review', 'rejected'),
    ('approved', 'funded'), ('approved', 'cancelled'),
    ('funded', 'delivery_submitted'), ('funded', 'expired'),
    ('delivery_submitted', 'delivery_verified'), ('delivery_submitted', 'funded'),
    ('delivery_verified', 'completed')
  );
$$;

-- Compare-and-set status change plus audit event in one transaction (ADR-010).
-- Returns the new event id, or null when the case is not currently in p_from.
create or replace function public.transition_case(
  p_case_id uuid,
  p_from text,
  p_to text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_transaction_signature text default null,
  p_internal_note text default null,
  p_approval jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.case_transition_allowed(p_from, p_to) then
    raise exception 'transition % -> % is not allowed', p_from, p_to using errcode = 'check_violation';
  end if;

  update public.relief_cases c
     set application_status = p_to,
         approved_amount_base_units = coalesce((p_approval ->> 'approved_amount_base_units')::bigint, c.approved_amount_base_units),
         escrow_expires_at = coalesce((p_approval ->> 'escrow_expires_at')::timestamptz, c.escrow_expires_at),
         assigned_supplier_organization_id = coalesce((p_approval ->> 'assigned_supplier_organization_id')::uuid, c.assigned_supplier_organization_id),
         supplier_wallet_pubkey = coalesce(p_approval ->> 'supplier_wallet_pubkey', c.supplier_wallet_pubkey)
   where c.id = p_case_id
     and c.application_status = p_from;

  if not found then
    return null;
  end if;

  insert into public.case_events (
    case_id, actor_user_id, actor_role, event_type, event_payload_public, transaction_signature, internal_note
  ) values (
    p_case_id, p_actor_user_id, p_actor_role, p_event_type,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('from', p_from, 'to', p_to),
    p_transaction_signature, p_internal_note
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.transition_case(uuid, text, text, uuid, text, text, jsonb, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.transition_case(uuid, text, text, uuid, text, text, jsonb, text, text, jsonb)
  to service_role;
