-- Minimal stand-ins for Supabase-provided objects so the migrations and DB tests can run on a
-- plain PostgreSQL 17 server when the Supabase Docker stack is unavailable.
-- Apply BEFORE the migrations. NEVER apply to a real Supabase database.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);
-- Same claim source as Supabase's auth.uid().
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);

-- Supabase grants table/function/sequence access in public to API roles by default;
-- RLS and explicit revokes then restrict it.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
