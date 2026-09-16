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
