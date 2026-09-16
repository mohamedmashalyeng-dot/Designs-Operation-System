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
