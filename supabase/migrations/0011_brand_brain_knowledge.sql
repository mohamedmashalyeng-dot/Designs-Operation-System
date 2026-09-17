-- ─────────────────────────────────────────────────────────────────────────
-- 0011_brand_brain_knowledge.sql
-- Extends the existing Brand Brain (brands/brand_rules/audiences/products,
-- from 0002_brand_brain.sql) with a knowledge base, inspiration/competitor
-- references, campaign recommendations, and a home for future performance
-- data. Reuses every existing entity rather than duplicating it — this
-- migration only adds what genuinely doesn't exist yet.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── brand_rules: structure + priority (product spec §5/§6) ────────────────
create type brand_rule_category as enum ('visual', 'copy', 'logo', 'photography', 'compliance', 'audience', 'platform', 'campaign');
create type brand_rule_priority as enum ('critical', 'high', 'normal', 'preference');

alter table brand_rules
  add column category brand_rule_category not null default 'campaign',
  add column priority brand_rule_priority not null default 'normal',
  add column source text;

-- ── products: richer course/offering data (product spec §7/§8) ────────────
alter table products
  add column long_description text,
  add column delivery_info text,
  add column approved_claims text[] not null default '{}',
  add column prohibited_claims text[] not null default '{}',
  add column keywords text[] not null default '{}',
  add column status text not null default 'active';

-- ── audiences: richer profile data (product spec §9) ───────────────────────
alter table audiences
  add column roles text[] not null default '{}',
  add column objections text[] not null default '{}',
  add column avoid_messaging text,
  add column tone text[] not null default '{}',
  add column platforms text[] not null default '{}';

-- ── knowledge_documents ─────────────────────────────────────────────────
-- Uploaded (or, later, Drive-synced) source material. storage_path is null
-- for a Drive-sourced document until/if Drive sync downloads a copy.
create type knowledge_source_type as enum ('upload', 'drive');
create type knowledge_document_status as enum ('uploaded', 'processing', 'ready', 'failed', 'outdated');

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null,
  source_type knowledge_source_type not null default 'upload',
  storage_path text,
  mime_type text,
  size_bytes bigint,
  status knowledge_document_status not null default 'uploaded',
  error_message text,
  content_hash text,
  -- Populated only for source_type = 'drive' (prepared architecture —
  -- product spec §22/§23; no Drive integration ships in this phase).
  drive_file_id text,
  drive_modified_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_documents_organisation_id_idx on knowledge_documents (organisation_id);
create index knowledge_documents_status_idx on knowledge_documents (status);

create trigger set_knowledge_documents_updated_at
  before update on knowledge_documents
  for each row execute function set_updated_at();

alter table knowledge_documents enable row level security;

create policy "knowledge_documents_select" on knowledge_documents for select
  using (is_member_of_org(organisation_id));
create policy "knowledge_documents_insert" on knowledge_documents for insert
  with check (is_member_of_org(organisation_id));
create policy "knowledge_documents_update" on knowledge_documents for update
  using (is_member_of_org(organisation_id));
create policy "knowledge_documents_delete" on knowledge_documents for delete
  using (is_member_of_org(organisation_id));

-- ── knowledge_chunks ────────────────────────────────────────────────────
-- organisation_id is denormalised (rather than derived only via
-- document_id → knowledge_documents) so retrieval can filter directly
-- without a join, same reasoning as generated_assets.organisation_id.
-- embedding is nullable: full-text search (search_vector) always works;
-- vector similarity is an enhancement available only once a real
-- embedding provider is configured — never faked from a meaningless
-- mock vector.
create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents (id) on delete cascade,
  organisation_id uuid not null references organisations (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  search_vector tsvector generated always as (to_tsvector('english', content)) stored,
  embedding vector(1536),
  embedding_model text,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index knowledge_chunks_organisation_id_idx on knowledge_chunks (organisation_id);
create index knowledge_chunks_document_id_idx on knowledge_chunks (document_id);
create index knowledge_chunks_search_vector_idx on knowledge_chunks using gin (search_vector);
-- ivfflat needs training data to be useful; fine to add once real content
-- volume exists. A plain btree-free sequential scan is acceptable at the
-- scale this product operates at today.
create index knowledge_chunks_embedding_idx on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table knowledge_chunks enable row level security;

create policy "knowledge_chunks_select" on knowledge_chunks for select
  using (is_member_of_org(organisation_id));
create policy "knowledge_chunks_insert" on knowledge_chunks for insert
  with check (is_member_of_org(organisation_id));
create policy "knowledge_chunks_delete" on knowledge_chunks for delete
  using (is_member_of_org(organisation_id));

-- ── inspiration_items (product spec §32) ───────────────────────────────
create table inspiration_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null,
  url text,
  storage_path text,
  notes text,
  category text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index inspiration_items_organisation_id_idx on inspiration_items (organisation_id);

alter table inspiration_items enable row level security;

create policy "inspiration_items_select" on inspiration_items for select
  using (is_member_of_org(organisation_id));
create policy "inspiration_items_insert" on inspiration_items for insert
  with check (is_member_of_org(organisation_id));
create policy "inspiration_items_delete" on inspiration_items for delete
  using (is_member_of_org(organisation_id));

-- ── competitors (product spec §33) ─────────────────────────────────────
create table competitors (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  website text,
  notes text,
  created_at timestamptz not null default now()
);

create index competitors_organisation_id_idx on competitors (organisation_id);

alter table competitors enable row level security;

create policy "competitors_select" on competitors for select
  using (is_member_of_org(organisation_id));
create policy "competitors_insert" on competitors for insert
  with check (is_member_of_org(organisation_id));
create policy "competitors_delete" on competitors for delete
  using (is_member_of_org(organisation_id));

-- ── campaign_recommendations (product spec §39-42) ─────────────────────
create type recommendation_status as enum ('suggested', 'saved', 'dismissed', 'created');

create table campaign_recommendations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null,
  reason text not null,
  objective campaign_objective,
  audience_type audience_type,
  product_id uuid references products (id) on delete set null,
  suggested_concept text,
  suggested_channels channel[] not null default '{}',
  priority text not null default 'normal',
  evidence text not null,
  confidence text not null default 'medium',
  status recommendation_status not null default 'suggested',
  dismissal_reason text,
  resulting_campaign_id uuid references campaigns (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_recommendations_organisation_id_idx on campaign_recommendations (organisation_id);
create index campaign_recommendations_status_idx on campaign_recommendations (status);

create trigger set_campaign_recommendations_updated_at
  before update on campaign_recommendations
  for each row execute function set_updated_at();

alter table campaign_recommendations enable row level security;

create policy "campaign_recommendations_select" on campaign_recommendations for select
  using (is_member_of_org(organisation_id));
create policy "campaign_recommendations_insert" on campaign_recommendations for insert
  with check (is_member_of_org(organisation_id));
create policy "campaign_recommendations_update" on campaign_recommendations for update
  using (is_member_of_org(organisation_id));

-- ── performance_snapshots (product spec §34/§35 — schema only; no sync
-- ships in this phase, see knowledge_document_status-style honesty rule:
-- never populate this with fabricated data) ────────────────────────────
create table performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  published_post_id uuid not null references published_posts (id) on delete cascade,
  metric_type text not null,
  value numeric not null,
  captured_at timestamptz not null default now(),
  raw jsonb not null default '{}'
);

create index performance_snapshots_organisation_id_idx on performance_snapshots (organisation_id);
create index performance_snapshots_published_post_id_idx on performance_snapshots (published_post_id);

alter table performance_snapshots enable row level security;

create policy "performance_snapshots_select" on performance_snapshots for select
  using (is_member_of_org(organisation_id));
