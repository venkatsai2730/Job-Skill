-- Run this in your Supabase SQL Editor

CREATE TABLE public.applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'Applied',
    date_applied DATE,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    interview_progress TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Create an index to speed up fetching a user's applications
CREATE INDEX idx_applications_user_id ON public.applications (user_id);

-- Optional: Add a unique constraint if you want to prevent duplicate applications for the same role at the same company
ALTER TABLE public.applications ADD CONSTRAINT unique_user_company_role UNIQUE (user_id, company, role);
