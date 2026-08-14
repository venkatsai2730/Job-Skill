-- ═══════════════════════════════════════════════════════════════
-- Job interaction log — what users actually do with recommendations.
--
-- Distinct from user_activity, which is a human-readable DISPLAY feed
-- for the dashboard. This table is the machine-readable interaction
-- log: which job was shown to whom, at what rank, and what happened.
-- It is the source of the (user, job, outcome) labels that the ranking
-- TODOs in relevanceScorer / shortlistingChance depend on, and of the
-- junk-rate metric that tells us whether the feed is improving.
--
-- DPDP note: behavioural data about identifiable users. user_id only —
-- never résumé content or contact fields. Must be covered by the
-- retention policy and deleted along with the account.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_interactions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL,
    job_id      TEXT NOT NULL,
    event       TEXT NOT NULL,   -- impression | click | save | apply | dismiss
    position    INT,             -- rank in the feed when shown
    pool        TEXT,            -- primary | cross_domain
    score       NUMERIC,         -- relevance_score at serve time
    created_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_interactions_user    ON job_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_job     ON job_interactions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_interactions_event   ON job_interactions(event);
CREATE INDEX IF NOT EXISTS idx_job_interactions_created ON job_interactions(created_at DESC);

-- All access is server-side via the service-role key, which bypasses
-- RLS. Enable RLS with no policies so a leaked anon key cannot read
-- users' browsing behaviour.
ALTER TABLE job_interactions ENABLE ROW LEVEL SECURITY;
