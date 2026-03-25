-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI — Database Migration (Complete)
-- Run this ENTIRE script in Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS everywhere
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. JOB LISTINGS — New columns for classification & filtering
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE job_listings
ADD COLUMN IF NOT EXISTS seniority_level TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS match_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India',
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time',
ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP;

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_jobs_seniority ON job_listings(seniority_level);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON job_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON job_listings(category);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON job_listings(city);
CREATE INDEX IF NOT EXISTS idx_jobs_country ON job_listings(country);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON job_listings(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON job_listings(source);

-- ═══════════════════════════════════════════════════════════════
-- 2. USER PROFILES — For resume-based job matching
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    skills TEXT[] DEFAULT '{}',
    experience_years NUMERIC DEFAULT 0,
    education TEXT,
    current_role TEXT,
    target_roles TEXT[] DEFAULT '{}',
    preferred_locations TEXT[] DEFAULT '{}',
    seniority_level TEXT DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Add target_roles column if table already exists but column doesn't
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════
-- 3. CHAT CONVERSATIONS — For persistent chat history
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Chat',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON chat_conversations(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    feature TEXT,
    tokens INT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. USER NOTIFICATIONS — For daily job alerts
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'job_alert',
    title TEXT NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT false,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON user_notifications(read);

-- ═══════════════════════════════════════════════════════════════
-- 5. TRACKED JOBS — Ensure starred column exists
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE tracked_jobs
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- DONE! All migrations applied successfully.
-- ═══════════════════════════════════════════════════════════════
