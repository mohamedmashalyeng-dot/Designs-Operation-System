-- ─────────────────────────────────────────────────────────────────────────
-- 0009_channel_adaptation.sql
-- Links a channel-specific adaptation (e.g. the Instagram Portrait version
-- of an approved LinkedIn creative) back to the approved design it was
-- prepared from — the grouping mechanism the "Prepare Campaign" final
-- review screen uses to show every channel version of one campaign
-- together. A design with no master is itself a master (the original,
-- directly-approved creative).
-- ─────────────────────────────────────────────────────────────────────────

alter table designs
  add column master_design_id uuid references designs (id) on delete set null;

create index designs_master_design_id_idx on designs (master_design_id);
