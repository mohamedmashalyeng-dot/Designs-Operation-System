-- ─────────────────────────────────────────────────────────────────────────
-- 0008_visual_variations.sql
-- Format-aware generation: a design targets one social format and can be
-- generated as several meaningfully-different visual variations that a
-- human picks between before one becomes design_version 1. Formats and
-- layout presets are app-level config (src/lib/creative/formats.ts,
-- layouts.ts), not DB tables — same pattern already used for
-- campaigns.channels, so adding one is a code change, not a migration.
-- ─────────────────────────────────────────────────────────────────────────

alter type design_status add value if not exists 'variations_ready';

-- The format a design targets. Fixed for the lifetime of a design — asking
-- for another platform size creates a new design (see adaptDesignFormat in
-- src/lib/creative/designs.ts), it doesn't mutate this one.
--
-- latest_batch_id points at the most recent generation_variations batch for
-- this design (see generated_assets.generation_batch_id below) — needed
-- because generated_assets only links to a campaign/concept, not a design,
-- and two designs can share a concept_id (format adaptation), so
-- concept_id alone can't disambiguate whose pending batch is whose.
alter table designs
  add column format_id text not null default 'linkedin_landscape',
  add column latest_batch_id uuid;

-- The layout preset used to composite this version's headline/copy/CTA/logo
-- over its image (see src/lib/creative/layouts.ts + CreativeRenderer).
-- Versioned like headline/copy/cta so history reflects layout changes too.
alter table design_versions
  add column layout_preset text not null default 'bottom_message';

-- generation_batch_id groups the N candidate images produced by one
-- "Generate Creative" click, before any of them is attached to a version —
-- lets the review UI query "unattached candidates for this design" for the
-- variation picker. focal_x/focal_y (0-1, image-relative) support
-- crop-aware rendering when an asset is reused across formats.
alter table generated_assets
  add column generation_batch_id uuid,
  add column focal_x numeric,
  add column focal_y numeric;

create index generated_assets_batch_id_idx on generated_assets (generation_batch_id);
