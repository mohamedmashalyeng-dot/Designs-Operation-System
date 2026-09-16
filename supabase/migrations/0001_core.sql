-- ─────────────────────────────────────────────────────────────────────────
-- 0001_core.sql
-- Profiles, organisations, membership, and the shared helper functions
-- every later migration's RLS policies build on.
-- ─────────────────────────────────────────────────────────────────────────

-- Supabase projects have pgcrypto enabled by default (gen_random_uuid()).

create type organisation_role as enum ('owner', 'admin', 'member');

-- ── updated_at helper, reused by every table below that has the column ────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ────────────────────────────────────────────────────────────
-- One row per auth.users, created by the handle_new_user trigger below.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles for select
  using (id = auth.uid());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

-- ── organisations ───────────────────────────────────────────────────────
create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_organisations_updated_at
  before update on organisations
  for each row execute function set_updated_at();

-- ── organisation_members ────────────────────────────────────────────────
create table organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role organisation_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create index organisation_members_user_id_idx on organisation_members (user_id);
create index organisation_members_org_id_idx on organisation_members (organisation_id);

-- ── membership helper functions ────────────────────────────────────────
-- SECURITY DEFINER + owned by the migration role (which has BYPASSRLS in
-- Supabase), so these read organisation_members without tripping that
-- table's own RLS policies and causing recursion.
create or replace function public.is_member_of_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organisation_members
    where organisation_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_admin_of_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organisation_members
    where organisation_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

alter table organisations enable row level security;

create policy "organisations_select" on organisations for select
  using (is_member_of_org(id));
-- Insert is intentionally open to any authenticated user: creating an
-- organisation and joining it as owner happens together (see
-- handle_new_user / create_organisation below), so there is no member row
-- yet at the moment of insert.
create policy "organisations_insert" on organisations for insert
  to authenticated
  with check (true);
create policy "organisations_update" on organisations for update
  using (is_admin_of_org(id));

alter table organisation_members enable row level security;

create policy "organisation_members_select" on organisation_members for select
  using (is_member_of_org(organisation_id));
create policy "organisation_members_insert" on organisation_members for insert
  with check (is_admin_of_org(organisation_id));
create policy "organisation_members_update" on organisation_members for update
  using (is_admin_of_org(organisation_id));
create policy "organisation_members_delete" on organisation_members for delete
  using (is_admin_of_org(organisation_id));

-- ── auto-provisioning on signup ────────────────────────────────────────
-- Every new user gets a profile plus a personal organisation they own, so
-- the app never has to handle a "user with no workspace" state. Users can
-- be invited into additional organisations later via organisation_members.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  base_slug := coalesce(
    nullif(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g'), ''),
    'workspace'
  );
  final_slug := base_slug;

  while exists (select 1 from public.organisations where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.organisations (name, slug)
  values (coalesce(new.raw_user_meta_data ->> 'organisation_name', 'My Workspace'), final_slug)
  returning id into new_org_id;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
