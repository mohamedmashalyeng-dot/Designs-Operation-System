-- ─────────────────────────────────────────────────────────────────────────
-- 0010_publication_job_controls.sql
-- Adds the "cancelled" status (product spec §25/§32 — cancelling a
-- scheduled post shouldn't just delete the audit row) needed for
-- reschedule/cancel controls on the Calendar page.
-- ─────────────────────────────────────────────────────────────────────────

alter type publication_status add value if not exists 'cancelled';
