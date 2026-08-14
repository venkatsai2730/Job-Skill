-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI — Add job_domain column to job_listings
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE job_listings
ADD COLUMN IF NOT EXISTS job_domain TEXT DEFAULT 'generic';

CREATE INDEX IF NOT EXISTS idx_jobs_job_domain ON job_listings(job_domain);

-- Backfill: mark all existing jobs as 'generic' (classifier will
-- re-tag them on next query or ingestion cycle).
-- UPDATE job_listings SET job_domain = 'generic' WHERE job_domain IS NULL;
