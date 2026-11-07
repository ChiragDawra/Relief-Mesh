-- ReliefMesh initial schema. Hackathon prototype; synthetic data only.
-- Apply to a dedicated Supabase development project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_wallet_pubkey text,
  created_at timestamptz not null default now(),
  constraint profiles_wallet_nonempty check (default_wallet_pubkey is null or length(trim(default_wallet_pubkey)) > 20)
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  organization_type text not null check (organization_type in ('ngo','supplier','donor_group','admin')),
  demo_only boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('field_worker','ngo_reviewer','supplier','donor','admin')),
  wallet_pubkey text,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create table if not exists public.relief_cases (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,
  organization_id uuid not null references public.organizations(id),
  created_by uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('food','water','shelter','medical','transport','other')),
  description_redacted text not null check (length(description_redacted) between 5 and 5000),
  locality_label text not null check (length(locality_label) between 2 and 120),
  household_count integer check (household_count is null or household_count > 0),
  requested_items jsonb not null default '[]'::jsonb,
  requested_amount_base_units bigint not null check (requested_amount_base_units > 0),
  token_decimals smallint not null check (token_decimals between 0 and 12),
  urgency_suggestion text check (urgency_suggestion is null or urgency_suggestion in ('low','medium','high','critical')),
  urgency_human_override text check (urgency_human_override is null or urgency_human_override in ('low','medium','high','critical')),
  application_status text not null default 'submitted' check (application_status in ('submitted','needs_information','under_review','approved','funded','delivery_submitted','delivery_verified','completed','flagged','cancelled','expired','rejected')),
  ai_status text not null default 'pending' check (ai_status in ('pending','completed','unavailable','needs_review','failed')),
  assigned_supplier_organization_id uuid references public.organizations(id),
  supplier_wallet_pubkey text,
  case_ref_hash text not null unique check (case_ref_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.relief_cases(id) on delete cascade,
  agent_type text not null check (agent_type in ('intake','duplicate','evidence')),
  model_provider text not null,
  model_version text,
  input_fingerprint text not null,
  output jsonb not null,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create table if not exists public.case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.relief_cases(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256_hash text not null check (sha256_hash ~ '^[0-9a-f]{64}$'),
  evidence_type text not null check (evidence_type in ('request_support','invoice','delivery_note','other')),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.relief_cases(id) on delete cascade,
  supplier_user_id uuid references public.profiles(id) on delete set null,
  invoice_reference text,
  invoice_total_base_units bigint check (invoice_total_base_units is null or invoice_total_base_units >= 0),
  line_items jsonb not null default '[]'::jsonb,
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  review_status text not null default 'submitted' check (review_status in ('submitted','needs_correction','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.escrow_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.relief_cases(id) on delete cascade,
  network text not null default 'devnet' check (network = 'devnet'),
  program_id text not null,
  escrow_pda text not null unique,
  vault_token_account text not null,
  token_mint text not null,
  authority_wallet text not null,
  supplier_wallet text not null,
  donor_wallet text,
  target_amount_base_units bigint not null check (target_amount_base_units > 0),
  chain_status text not null default 'unknown' check (chain_status in ('created','funded','released','refunded','unknown')),
  create_signature text,
  fund_signature text,
  release_signature text,
  refund_signature text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.relief_cases(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text not null,
  event_type text not null,
  event_payload_public jsonb not null default '{}'::jsonb,
  transaction_signature text,
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user_org on public.memberships(user_id, organization_id);
create index if not exists idx_cases_org_status_created on public.relief_cases(organization_id, application_status, created_at desc);
create index if not exists idx_cases_supplier_org on public.relief_cases(assigned_supplier_organization_id, application_status);
create index if not exists idx_ai_assessments_case_created on public.ai_assessments(case_id, created_at desc);
create index if not exists idx_evidence_case_created on public.case_evidence(case_id, created_at desc);
create index if not exists idx_delivery_case_created on public.delivery_submissions(case_id, created_at desc);
create index if not exists idx_case_events_case_created on public.case_events(case_id, created_at);

-- Security-definer helpers avoid recursive RLS evaluation on memberships.
create or replace function public.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

create or replace function public.can_access_case(p_case_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.relief_cases c
    where c.id = p_case_id
      and (
        public.has_org_role(c.organization_id, p_roles)
        or (
          c.assigned_supplier_organization_id is not null
          and public.has_org_role(c.assigned_supplier_organization_id, p_roles)
        )
      )
  );
$$;

revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.can_access_case(uuid, text[]) from public;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.can_access_case(uuid, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.relief_cases enable row level security;
alter table public.ai_assessments enable row level security;
alter table public.case_evidence enable row level security;
alter table public.delivery_submissions enable row level security;
alter table public.escrow_records enable row level security;
alter table public.case_events enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_select_member on public.organizations
  for select to authenticated using (public.has_org_role(id, array['field_worker','ngo_reviewer','supplier','donor','admin']));

create policy memberships_select_self_or_org_admin on public.memberships
  for select to authenticated using (
    user_id = auth.uid() or public.has_org_role(organization_id, array['admin'])
  );

create policy cases_select_org_staff on public.relief_cases
  for select to authenticated using (
    public.has_org_role(organization_id, array['field_worker','ngo_reviewer','admin'])
    or (assigned_supplier_organization_id is not null and public.has_org_role(assigned_supplier_organization_id, array['supplier','admin']))
  );

create policy cases_insert_field_worker on public.relief_cases
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.has_org_role(organization_id, array['field_worker','admin'])
  );

create policy cases_update_org_staff on public.relief_cases
  for update to authenticated using (
    public.has_org_role(organization_id, array['field_worker','ngo_reviewer','admin'])
  ) with check (
    public.has_org_role(organization_id, array['field_worker','ngo_reviewer','admin'])
  );

create policy ai_assessments_select_case_staff on public.ai_assessments
  for select to authenticated using (
    public.can_access_case(case_id, array['field_worker','ngo_reviewer','admin'])
  );

create policy evidence_select_case_staff on public.case_evidence
  for select to authenticated using (
    public.can_access_case(case_id, array['field_worker','ngo_reviewer','supplier','admin'])
  );

create policy delivery_select_assigned_supplier_or_ngo on public.delivery_submissions
  for select to authenticated using (
    public.can_access_case(case_id, array['supplier','field_worker','ngo_reviewer','admin'])
  );
create policy delivery_insert_assigned_supplier on public.delivery_submissions
  for insert to authenticated with check (
    supplier_user_id = auth.uid()
    and public.can_access_case(case_id, array['supplier','admin'])
  );

create policy escrow_select_case_staff on public.escrow_records
  for select to authenticated using (
    public.can_access_case(case_id, array['field_worker','ngo_reviewer','supplier','donor','admin'])
  );

create policy events_select_case_staff on public.case_events
  for select to authenticated using (
    public.can_access_case(case_id, array['field_worker','ngo_reviewer','supplier','donor','admin'])
  );

-- No client insert/update/delete policy for AI assessments, escrow records or case events.
-- The API may write these after verifying auth and (for chain records) independently
-- verifying the confirmed Devnet transaction. Service-role use must remain server-only.

-- Private evidence bucket. Upload/download should be mediated by the API after role checks.
insert into storage.buckets (id, name, public)
values ('case-evidence', 'case-evidence', false)
on conflict (id) do update set public = false;

