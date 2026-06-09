-- ═══════════════════════════════════════════════════════════════
-- User Activity Table — Stores real user actions for Dashboard feed
-- Run in Supabase SQL Editor — safe to re-run
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_activity (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     TEXT NOT NULL,
    type        TEXT NOT NULL,        -- e.g. 'resume_upload', 'ats_score', 'job_search'
    title       TEXT NOT NULL,        -- Human-readable description shown in UI
    meta        JSONB DEFAULT '{}',   -- Extra data: { score: 87, job: "Engineer at Stripe" }
    created_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity(created_at DESC);
