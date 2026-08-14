-- ═══════════════════════════════════════════════════════════════
-- JobSkill AI — "resumes" storage bucket + RLS policies
--
-- Supersedes the old supabase/storage_fix.sql, which made the bucket
-- public and granted anon SELECT/INSERT/UPDATE/DELETE on every object
-- in it. Résumé PDFs contain names, emails, phone numbers and
-- addresses, so those policies exposed personal data to anyone who
-- could guess or enumerate an object path, and let anyone overwrite or
-- delete another user's résumé.
--
-- Nothing in the app needs that access: every read and write of this
-- bucket goes through supabaseAdmin (the service-role key), which
-- bypasses RLS entirely — see server/src/routes/resume.ts. The
-- policies below therefore only need to cover a user reaching their
-- own objects directly, keyed on the `{userId}/...` path prefix the
-- upload route writes.
-- ═══════════════════════════════════════════════════════════════

-- 1. Ensure the bucket exists and is PRIVATE.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Drop the permissive policies from storage_fix.sql, plus any
--    same-named policies from re-runs of this file.
DROP POLICY IF EXISTS "public view resumes" ON storage.objects;
DROP POLICY IF EXISTS "anon upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "auth upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "auth update resumes" ON storage.objects;
DROP POLICY IF EXISTS "auth delete resumes" ON storage.objects;
DROP POLICY IF EXISTS "resumes owner select" ON storage.objects;
DROP POLICY IF EXISTS "resumes owner insert" ON storage.objects;
DROP POLICY IF EXISTS "resumes owner update" ON storage.objects;
DROP POLICY IF EXISTS "resumes owner delete" ON storage.objects;

-- 3. Owner-scoped policies. Objects live at `{user_id}/{ts}-{name}`,
--    so the first path segment must match the caller's uid.
--    The app currently signs its own JWTs rather than using Supabase
--    Auth, so auth.uid() is null for a direct client call and these
--    policies deny it — which is the intended default. They become
--    functional (rather than purely deny-by-default) if the client is
--    ever pointed at Supabase Auth and reads the bucket directly.
CREATE POLICY "resumes owner select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
