import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Admin client with service role key — full DB access, bypasses RLS.
//
// IMPORTANT: never run user session-setting auth calls (signInWithPassword,
// signInWithOAuth, setSession, verifyOtp…) on this shared instance. Those store
// an in-memory session on the client, and supabase-js then sends that user's
// `authenticated` JWT — instead of the service_role key — on every subsequent
// `.from()` query. That silently downgrades this client to a regular user, so
// writes to RLS-protected tables (resumes, jobs, …) start failing with
// "new row violates row-level security policy". Use createAuthClient() for
// those flows so this instance stays pure service_role.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Throwaway client for user-session auth flows (signInWithPassword, OAuth, etc.).
// Isolated per call and discarded afterwards, so the session it captures never
// leaks onto the shared supabaseAdmin client. See the note above for why.
export function createAuthClient() {
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
