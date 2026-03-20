-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI — Database Migration
-- Run this in Supabase SQL Editor before deploying
-- ═══════════════════════════════════════════════════════════════

-- New columns on job_listings
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
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full-time';

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_jobs_seniority ON job_listings(seniority_level);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON job_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON job_listings(category);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON job_listings(city);

-- User profiles table for resume-based matching
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    skills TEXT[] DEFAULT '{}',
    experience_years NUMERIC DEFAULT 0,
    education TEXT,
    current_role TEXT,
    preferred_locations TEXT[] DEFAULT '{}',
    seniority_level TEXT DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
