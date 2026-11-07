-- Synthetic organizations only. No real beneficiaries or aid organizations.
insert into public.organizations (id, name, organization_type, demo_only)
values
  ('10000000-0000-4000-8000-000000000001', 'ReliefMesh Demo NGO', 'ngo', true),
  ('10000000-0000-4000-8000-000000000002', 'ReliefMesh Demo Supplier', 'supplier', true),
  ('10000000-0000-4000-8000-000000000003', 'ReliefMesh Demo Donor Group', 'donor_group', true)
on conflict (id) do nothing;

-- Add Supabase Auth test users through the Supabase dashboard/CLI first.
-- Then insert matching profile and membership rows using their auth.users UUIDs.
-- Example (replace with generated local test UUIDs):
-- insert into public.profiles (id, display_name) values ('<AUTH_USER_UUID>', 'Demo NGO Reviewer');
-- insert into public.memberships (organization_id, user_id, role, wallet_pubkey)
-- values ('10000000-0000-4000-8000-000000000001', '<AUTH_USER_UUID>', 'ngo_reviewer', '<DEVNET_PUBLIC_KEY>');

-- Cases are intentionally not seeded here because case_ref_hash should be generated
-- cryptographically by the seed script and each case should have a valid workflow history.
