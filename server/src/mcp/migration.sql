-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI v2.0 — Database Migration
-- Run this in Supabase SQL Editor before deploying the upgrade.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add skill metadata columns to job_listings
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS required_skills text[];
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS seniority text;
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS search_term text;

-- 2. Performance indexes for new columns
CREATE INDEX IF NOT EXISTS idx_jobs_required_skills ON job_listings USING GIN(required_skills);
CREATE INDEX IF NOT EXISTS idx_jobs_seniority_active ON job_listings(seniority, is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_search_term ON job_listings(search_term);

-- 3. Agent memory table — persistent across sessions
CREATE TABLE IF NOT EXISTS user_memories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    key         text NOT NULL,
    value       jsonb NOT NULL,
    session_id  text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now(),
    UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);

-- 4. Agent steps table — transparency log for agentic chatbot
CREATE TABLE IF NOT EXISTS agent_steps (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  text NOT NULL,
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id  text,
    steps       jsonb,
    tools_used  text[],
    intent      text,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_steps_session ON agent_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_user ON agent_steps(user_id);
