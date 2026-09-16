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
