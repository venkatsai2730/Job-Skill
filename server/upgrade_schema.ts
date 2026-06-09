import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
    console.log("Upgrading Supabase schema...");
    
    // Using postgres functions or direct SQL execution isn't exposed via the JS client easily
    // We'll create a temporary RPC function if it doesn't exist, or just instruct the user.
    // However, if we can run raw SQL:
    
    const query = `
    ALTER TABLE job_listings
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India',
      ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS employment_type TEXT,
      ADD COLUMN IF NOT EXISTS work_authorization TEXT,
      ADD COLUMN IF NOT EXISTS company_size TEXT,
      ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
      ADD COLUMN IF NOT EXISTS normalized_salary_min INT,
      ADD COLUMN IF NOT EXISTS normalized_salary_max INT,
      ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS apply_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

    CREATE INDEX IF NOT EXISTS idx_jobs_category ON job_listings(category);
    CREATE INDEX IF NOT EXISTS idx_jobs_country ON job_listings(country);
    CREATE INDEX IF NOT EXISTS idx_jobs_city ON job_listings(city);
    CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON job_listings(is_active);
    CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON job_listings(employment_type);
    `;
    
    // We cannot run raw SQL directly through the Supabase JS client without an RPC method setup.
    // Instead, let's create a script that outputs the SQL so the user knows to run it if the RPC attempt fails.
    console.log("SQL TO RUN IN SUPABASE SQL EDITOR:\n", query);
    
    // Trying REST post bypassing JS client just in case postgres meta is open
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ query })
        });
        if (res.ok) {
            console.log("Raw execution might have succeeded.");
        }
    } catch (e) {
        // ignore
    }

    console.log("done");
}

run();
