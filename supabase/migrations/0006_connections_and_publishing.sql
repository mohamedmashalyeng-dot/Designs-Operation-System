-- ─────────────────────────────────────────────────────────────────────────
-- 0006_connections_and_publishing.sql
-- Third-party integrations (Canva/Meta/LinkedIn/Website) and the publishing
-- pipeline. Publishing itself is out of scope for the MVP (see product
-- spec §25) but the schema is shaped so provider adapters can be added
-- without a rewrite.
-- ─────────────────────────────────────────────────────────────────────────

create type connection_provider as enum ('canva', 'meta', 'linkedin', 'website');
create type connection_status as enum ('connected', 'disconnected', 'error', 'expired');
create type publication_status as enum ('queued', 'scheduled', 'publishing', 'published', 'failed');

-- ── connections ─────────────────────────────────────────────────────────
-- Tokens are written ONLY by trusted server code using the service-role
-- client (e.g. an OAuth callback route) — see column grants below. The
-- `authenticated` role never gets INSERT/UPDATE here, and its SELECT
-- grant excludes both token columns, so a leaked query or an over-eager
-- `select *` in application code cannot leak a credential to the browser.
create table connections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  provider connection_provider not null,
  status connection_status not null default 'disconnected',
  external_account_id text,
  external_account_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, provider)
);

create index connections_organisation_id_idx on connections (organisation_id);

create trigger set_connections_updated_at
  before update on connections
  for each row execute function set_updated_at();

alter table connections enable row level security;

create policy "connections_select" on connections for select
  using (is_member_of_org(organisation_id));

revoke select on connections from authenticated;
grant select (
  id, organisation_id, provider, status, external_account_id,
  external_account_name, expires_at, metadata, created_at, updated_at
) on connections to authenticated;
grant all on connections to service_role;

-- ── publication_jobs ────────────────────────────────────────────────────
create table publication_jobs (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs (id) on delete cascade,
  connection_id uuid not null references connections (id) on delete restrict,
  channel channel not null,
  scheduled_for timestamptz,
  status publication_status not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index publication_jobs_design_id_idx on publication_jobs (design_id);
create index publication_jobs_status_idx on publication_jobs (status);

create trigger set_publication_jobs_updated_at
  before update on publication_jobs
  for each row execute function set_updated_at();

alter table publication_jobs enable row level security;

create policy "publication_jobs_select" on publication_jobs for select
  using (is_member_of_org(org_id_for_design(design_id)));
create policy "publication_jobs_insert" on publication_jobs for insert
  with check (is_member_of_org(org_id_for_design(design_id)));

-- ── published_posts ─────────────────────────────────────────────────────
create table published_posts (
  id uuid primary key default gen_random_uuid(),
  publication_job_id uuid not null references publication_jobs (id) on delete cascade,
  design_id uuid not null references designs (id) on delete cascade,
  connection_id uuid not null references connections (id) on delete restrict,
  external_post_id text,
  external_url text,
  published_at timestamptz not null default now(),
  metrics jsonb not null default '{}'
);

create index published_posts_design_id_idx on published_posts (design_id);

alter table published_posts enable row level security;

create policy "published_posts_select" on published_posts for select
  using (is_member_of_org(org_id_for_design(design_id)));
