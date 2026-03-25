-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI — Supabase Storage RLS Fix (Revised)
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Ensure the "resumes" bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop any existing policies that might conflict
DROP POLICY IF EXISTS "public view resumes" ON storage.objects;
DROP POLICY IF EXISTS "anon upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "auth upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "auth update resumes" ON storage.objects;
DROP POLICY IF EXISTS "auth delete resumes" ON storage.objects;

-- 3. Create extremely permissive policies covering ALL roles (anon, authenticated)
-- Anyone can view
CREATE POLICY "public view resumes" 
ON storage.objects FOR SELECT USING (bucket_id = 'resumes');

-- Anyone can upload (fixes 403 on insert)
CREATE POLICY "anon upload resumes" 
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes');

-- Anyone can update
CREATE POLICY "auth update resumes" 
ON storage.objects FOR UPDATE USING (bucket_id = 'resumes');

-- Anyone can delete
CREATE POLICY "auth delete resumes" 
ON storage.objects FOR DELETE USING (bucket_id = 'resumes');

-- ═══════════════════════════════════════════════════════════════
-- DONE!
-- ═══════════════════════════════════════════════════════════════
