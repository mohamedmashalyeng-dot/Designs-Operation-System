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
