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
-- ─────────────────────────────────────────────────────────────────────────
-- 0002_brand_brain.sql
-- Brand identity, rules, audiences, products, and brand assets.
-- ─────────────────────────────────────────────────────────────────────────

create type brand_asset_type as enum ('logo', 'image', 'document', 'other');

-- ── brands ──────────────────────────────────────────────────────────────
-- One organisation can in principle run multiple brands; MVP UI drives a
-- single primary brand per organisation, but the schema doesn't assume it.
create table brands (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  logo_url text,
  colours jsonb not null default '[]', -- [{ name: "Primary", hex: "#4F46E5" }]
  fonts jsonb not null default '[]',   -- [{ role: "Heading", family: "Inter" }]
  tone text[] not null default '{}',
  voice_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brands_organisation_id_idx on brands (organisation_id);

create trigger set_brands_updated_at
  before update on brands
  for each row execute function set_updated_at();

create or replace function public.org_id_for_brand(p_brand_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from brands where id = p_brand_id;
$$;

alter table brands enable row level security;

create policy "brands_select" on brands for select
  using (is_member_of_org(organisation_id));
create policy "brands_insert" on brands for insert
  with check (is_member_of_org(organisation_id));
create policy "brands_update" on brands for update
  using (is_member_of_org(organisation_id));
create policy "brands_delete" on brands for delete
  using (is_admin_of_org(organisation_id));

-- ── brand_rules ─────────────────────────────────────────────────────────
create table brand_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  rule_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index brand_rules_brand_id_idx on brand_rules (brand_id);

alter table brand_rules enable row level security;

create policy "brand_rules_select" on brand_rules for select
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "brand_rules_insert" on brand_rules for insert
  with check (is_member_of_org(org_id_for_brand(brand_id)));
create policy "brand_rules_update" on brand_rules for update
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "brand_rules_delete" on brand_rules for delete
  using (is_member_of_org(org_id_for_brand(brand_id)));

-- ── audiences ───────────────────────────────────────────────────────────
create table audiences (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  name text not null,
  description text,
  market text,
  problems text[] not null default '{}',
  motivations text[] not null default '{}',
  preferred_messaging text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audiences_brand_id_idx on audiences (brand_id);

create trigger set_audiences_updated_at
  before update on audiences
  for each row execute function set_updated_at();

alter table audiences enable row level security;

create policy "audiences_select" on audiences for select
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "audiences_insert" on audiences for insert
  with check (is_member_of_org(org_id_for_brand(brand_id)));
create policy "audiences_update" on audiences for update
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "audiences_delete" on audiences for delete
  using (is_member_of_org(org_id_for_brand(brand_id)));

-- ── products (courses / offerings) ─────────────────────────────────────
create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  audience_id uuid references audiences (id) on delete set null,
  name text not null,
  description text,
  benefits text[] not null default '{}',
  cta text,
  reference_material_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_brand_id_idx on products (brand_id);

create trigger set_products_updated_at
  before update on products
  for each row execute function set_updated_at();

alter table products enable row level security;

create policy "products_select" on products for select
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "products_insert" on products for insert
  with check (is_member_of_org(org_id_for_brand(brand_id)));
create policy "products_update" on products for update
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "products_delete" on products for delete
  using (is_member_of_org(org_id_for_brand(brand_id)));

-- ── brand_assets ────────────────────────────────────────────────────────
-- storage_path points into the `brand-assets` Storage bucket
-- (see 0007_storage.sql), namespaced as `{organisation_id}/{brand_id}/...`.
create table brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  type brand_asset_type not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index brand_assets_brand_id_idx on brand_assets (brand_id);

alter table brand_assets enable row level security;

create policy "brand_assets_select" on brand_assets for select
  using (is_member_of_org(org_id_for_brand(brand_id)));
create policy "brand_assets_insert" on brand_assets for insert
  with check (is_member_of_org(org_id_for_brand(brand_id)));
create policy "brand_assets_delete" on brand_assets for delete
  using (is_member_of_org(org_id_for_brand(brand_id)));
-- ─────────────────────────────────────────────────────────────────────────
-- 0003_campaigns.sql
-- Campaigns, AI creative briefs, and creative concepts.
-- ─────────────────────────────────────────────────────────────────────────

create type campaign_objective as enum (
  'awareness', 'leads', 'applications', 'employer_engagement', 'event_promotion', 'other'
);

create type audience_type as enum (
  'employers', 'apprentices', 'learners', 'professionals', 'custom'
);

create type channel as enum ('linkedin', 'instagram', 'facebook', 'website');

create type campaign_status as enum (
  'draft', 'brief_generating', 'brief_ready', 'concepts_generating',
  'concepts_ready', 'in_review', 'completed', 'archived'
);

create type concept_status as enum ('proposed', 'selected', 'rejected');

-- ── campaigns ───────────────────────────────────────────────────────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  brand_id uuid references brands (id) on delete set null,
  created_by uuid not null references auth.users (id),
  title text not null,
  raw_prompt text not null,
  objective campaign_objective not null default 'other',
  audience_type audience_type not null default 'custom',
  channels channel[] not null default '{}',
  status campaign_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaigns_organisation_id_idx on campaigns (organisation_id);
create index campaigns_status_idx on campaigns (status);
create index campaigns_brand_id_idx on campaigns (brand_id);

create trigger set_campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

create or replace function public.org_id_for_campaign(p_campaign_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from campaigns where id = p_campaign_id;
$$;

alter table campaigns enable row level security;

create policy "campaigns_select" on campaigns for select
  using (is_member_of_org(organisation_id));
create policy "campaigns_insert" on campaigns for insert
  with check (is_member_of_org(organisation_id) and created_by = auth.uid());
create policy "campaigns_update" on campaigns for update
  using (is_member_of_org(organisation_id));
create policy "campaigns_delete" on campaigns for delete
  using (is_admin_of_org(organisation_id));

-- ── creative_briefs ─────────────────────────────────────────────────────
-- Structured output of the AI Creative Director (see src/lib/ai/schemas.ts
-- for the Zod schema this mirrors). One campaign can be re-briefed, so this
-- is one-to-many even though the product flow usually keeps the latest.
create table creative_briefs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  campaign_objective text not null,
  target_audience text not null,
  core_message text not null,
  value_proposition text not null,
  tone text[] not null default '{}',
  visual_direction text not null,
  photography_direction text not null,
  emotional_direction text not null,
  cta text not null,
  platform_considerations text not null default '',
  constraints text[] not null default '{}',
  model_used text,
  raw_ai_response jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index creative_briefs_campaign_id_idx on creative_briefs (campaign_id);

alter table creative_briefs enable row level security;

create policy "creative_briefs_select" on creative_briefs for select
  using (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "creative_briefs_insert" on creative_briefs for insert
  with check (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "creative_briefs_delete" on creative_briefs for delete
  using (is_member_of_org(org_id_for_campaign(campaign_id)));

-- ── creative_concepts ───────────────────────────────────────────────────
create table creative_concepts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  creative_brief_id uuid not null references creative_briefs (id) on delete cascade,
  name text not null,
  strategic_idea text not null,
  visual_description text not null,
  headline text not null,
  supporting_copy text not null,
  cta text not null,
  image_prompt text not null,
  rationale text not null,
  status concept_status not null default 'proposed',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index creative_concepts_campaign_id_idx on creative_concepts (campaign_id);
create index creative_concepts_brief_id_idx on creative_concepts (creative_brief_id);

alter table creative_concepts enable row level security;

create policy "creative_concepts_select" on creative_concepts for select
  using (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "creative_concepts_insert" on creative_concepts for insert
  with check (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "creative_concepts_update" on creative_concepts for update
  using (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "creative_concepts_delete" on creative_concepts for delete
  using (is_member_of_org(org_id_for_campaign(campaign_id)));
-- ─────────────────────────────────────────────────────────────────────────
-- 0004_designs.sql
-- Designs, their version history, and AI-generated image assets.
--
-- A design separates the AI-generated visual (generated_assets) from the
-- marketing content layered on top (headline/copy/CTA, held on each
-- design_version) — see product spec §11. This keeps "regenerate the
-- image" and "edit the headline" as independent, composable operations
-- instead of requiring a full image re-render for a copy change.
-- ─────────────────────────────────────────────────────────────────────────

create type design_status as enum (
  'draft', 'generating', 'ai_review', 'human_review', 'changes_requested',
  'approved', 'rejected', 'scheduled', 'published'
);

create type asset_status as enum ('pending', 'generating', 'completed', 'failed');
create type canva_sync_status as enum ('not_synced', 'syncing', 'synced', 'error');

-- ── designs ─────────────────────────────────────────────────────────────
-- current_version_id is added via ALTER below, once design_versions exists
-- (the two tables reference each other).
create table designs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  concept_id uuid not null references creative_concepts (id) on delete cascade,
  title text not null,
  status design_status not null default 'draft',
  current_version_id uuid,
  canva_design_id text,
  canva_edit_url text,
  canva_last_synced_at timestamptz,
  canva_sync_status canva_sync_status not null default 'not_synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_campaign_id_idx on designs (campaign_id);
create index designs_concept_id_idx on designs (concept_id);
create index designs_status_idx on designs (status);

create trigger set_designs_updated_at
  before update on designs
  for each row execute function set_updated_at();

create or replace function public.org_id_for_design(p_design_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from campaigns c
  join designs d on d.campaign_id = c.id
  where d.id = p_design_id;
$$;

-- ── design_versions ─────────────────────────────────────────────────────
create table design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs (id) on delete cascade,
  version_number int not null,
  headline text not null,
  supporting_copy text not null,
  cta text not null,
  generated_asset_id uuid, -- FK added after generated_assets exists below
  change_description text not null,
  changed_by_user_id uuid references auth.users (id),
  changed_by_ai boolean not null default false,
  ai_prompt text,
  -- Structured output of the AI Quality/Brand Review (imageReviewSchema in
  -- src/lib/ai/schemas.ts), run automatically once the asset is attached.
  -- One review per version, so a jsonb column here beats a separate table.
  ai_review jsonb,
  created_at timestamptz not null default now(),
  unique (design_id, version_number)
);

create index design_versions_design_id_idx on design_versions (design_id);

alter table designs
  add constraint designs_current_version_id_fkey
  foreign key (current_version_id) references design_versions (id) on delete set null;

-- ── generated_assets ────────────────────────────────────────────────────
-- organisation_id is denormalised here (rather than derived only via
-- design_version → design → campaign) because assets can exist before a
-- design_version does — generation happens, then gets attached.
create table generated_assets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  campaign_id uuid references campaigns (id) on delete cascade,
  concept_id uuid references creative_concepts (id) on delete set null,
  design_version_id uuid references design_versions (id) on delete set null,
  provider text not null,
  model text not null,
  prompt text not null,
  mime_type text not null default 'image/png',
  width int not null,
  height int not null,
  storage_path text,
  status asset_status not null default 'pending',
  error_message text,
  parent_asset_id uuid references generated_assets (id) on delete set null,
  generation_params jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index generated_assets_org_id_idx on generated_assets (organisation_id);
create index generated_assets_campaign_id_idx on generated_assets (campaign_id);
create index generated_assets_design_version_id_idx on generated_assets (design_version_id);
create index generated_assets_status_idx on generated_assets (status);

alter table design_versions
  add constraint design_versions_generated_asset_id_fkey
  foreign key (generated_asset_id) references generated_assets (id) on delete set null;

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table designs enable row level security;

create policy "designs_select" on designs for select
  using (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "designs_insert" on designs for insert
  with check (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "designs_update" on designs for update
  using (is_member_of_org(org_id_for_campaign(campaign_id)));
create policy "designs_delete" on designs for delete
  using (is_member_of_org(org_id_for_campaign(campaign_id)));

alter table design_versions enable row level security;

create policy "design_versions_select" on design_versions for select
  using (is_member_of_org(org_id_for_design(design_id)));
create policy "design_versions_insert" on design_versions for insert
  with check (is_member_of_org(org_id_for_design(design_id)));
create policy "design_versions_update" on design_versions for update
  using (is_member_of_org(org_id_for_design(design_id)));

alter table generated_assets enable row level security;

create policy "generated_assets_select" on generated_assets for select
  using (is_member_of_org(organisation_id));
create policy "generated_assets_insert" on generated_assets for insert
  with check (is_member_of_org(organisation_id));
create policy "generated_assets_update" on generated_assets for update
  using (is_member_of_org(organisation_id));
-- ─────────────────────────────────────────────────────────────────────────
-- 0005_review.sql
-- Structured rejection/change feedback and approvals. This is the signal
-- future generations will learn from (see product spec §26) — reasons are
-- a closed set of enums specifically so they're aggregable later, with
-- `comment` as a free-text escape hatch.
-- ─────────────────────────────────────────────────────────────────────────

create type feedback_type as enum ('rejection', 'change_request', 'comment');

create type rejection_reason as enum (
  'too_generic', 'wrong_audience', 'poor_image', 'looks_like_stock_photography',
  'incorrect_branding', 'too_much_text', 'weak_headline', 'wrong_creative_direction',
  'incorrect_colours', 'other'
);

create type approval_status as enum ('approved', 'rejected');

-- ── feedback ────────────────────────────────────────────────────────────
create table feedback (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs (id) on delete cascade,
  design_version_id uuid references design_versions (id) on delete set null,
  user_id uuid not null references auth.users (id),
  type feedback_type not null,
  reasons rejection_reason[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

create index feedback_design_id_idx on feedback (design_id);

alter table feedback enable row level security;

create policy "feedback_select" on feedback for select
  using (is_member_of_org(org_id_for_design(design_id)));
create policy "feedback_insert" on feedback for insert
  with check (is_member_of_org(org_id_for_design(design_id)) and user_id = auth.uid());

-- ── approvals ───────────────────────────────────────────────────────────
create table approvals (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs (id) on delete cascade,
  design_version_id uuid not null references design_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  status approval_status not null,
  created_at timestamptz not null default now()
);

create index approvals_design_id_idx on approvals (design_id);

alter table approvals enable row level security;

create policy "approvals_select" on approvals for select
  using (is_member_of_org(org_id_for_design(design_id)));
create policy "approvals_insert" on approvals for insert
  with check (is_member_of_org(org_id_for_design(design_id)) and user_id = auth.uid());
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
-- ─────────────────────────────────────────────────────────────────────────
-- 0007_storage.sql
-- Storage buckets and access policies. Every object path is namespaced
-- `{organisation_id}/...` and every policy checks that prefix against
-- organisation_members via is_member_of_org(), so one organisation can
-- never read or write another's files. All buckets are private — nothing
-- is served publicly; the app issues signed URLs for display.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('brand-assets', 'brand-assets', false, 26214400,
    array['image/png','image/jpeg','image/svg+xml','image/webp','application/pdf']),
  ('campaign-assets', 'campaign-assets', false, 26214400,
    array['image/png','image/jpeg','image/webp']),
  -- image/svg+xml included alongside real raster formats because the mock
  -- image provider (used whenever OPENAI_API_KEY is unset) renders its
  -- clearly-labeled placeholders as SVG — see src/lib/ai/providers/mock.
  ('generated-images', 'generated-images', false, 26214400,
    array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('design-previews', 'design-previews', false, 26214400,
    array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('reference-images', 'reference-images', false, 26214400,
    array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- ── user-uploadable buckets ─────────────────────────────────────────────
-- brand-assets, campaign-assets, reference-images: members upload directly
-- from the browser (logo uploads, reference images, exported adaptations).
do $$
declare
  bucket text;
begin
  foreach bucket in array array['brand-assets', 'campaign-assets', 'reference-images']
  loop
    execute format(
      $p$create policy "%1$s_select" on storage.objects for select
        using (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
    execute format(
      $p$create policy "%1$s_insert" on storage.objects for insert
        with check (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
    execute format(
      $p$create policy "%1$s_delete" on storage.objects for delete
        using (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
  end loop;
end $$;

-- ── server-generated buckets ────────────────────────────────────────────
-- generated-images, design-previews: written only by server code on the
-- service-role client (the image-generation pipeline), which bypasses RLS
-- entirely — members get read-only access via these policies.
do $$
declare
  bucket text;
begin
  foreach bucket in array array['generated-images', 'design-previews']
  loop
    execute format(
      $p$create policy "%1$s_select" on storage.objects for select
        using (bucket_id = %1$L and is_member_of_org((storage.foldername(name))[1]::uuid))$p$,
      bucket
    );
  end loop;
end $$;
