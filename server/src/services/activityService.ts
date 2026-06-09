

import { supabaseAdmin } from "../config/supabase.js";

export type ActivityType =
    | "resume_upload"
    | "ats_score"
    | "job_search"
    | "job_saved"
    | "job_applied"
    | "cover_letter"
    | "linkedin_optimized"
    | "mock_interview"
    | "skill_analysis"
    | "chat_message";

export interface ActivityEvent {
    id?: string;
    user_id: string;
    type: ActivityType;
    title: string;          // Human-readable description (shown in UI)
    meta?: Record<string, any>; // Optional extra data (score, job title, etc.)
    created_at?: string;
}

// ── Create a new activity event ──────────────────────────────
export async function logActivity(event: Omit<ActivityEvent, "id" | "created_at">): Promise<void> {
    try {
        const { error } = await supabaseAdmin
            .from("user_activity")
            .insert({
                user_id: event.user_id,
                type: event.type,
                title: event.title,
                meta: event.meta || {},
            });
        if (error) {
            // Non-fatal — don't crash the calling route
            console.warn("[Activity] Failed to log event:", error.message);
        }
    } catch (err: any) {
        console.warn("[Activity] Exception logging event:", err.message);
    }
}

// ── Fetch recent activity for a user (most recent first) ─────
export async function getUserActivity(userId: string, limit = 15): Promise<ActivityEvent[]> {
    const { data, error } = await supabaseAdmin
        .from("user_activity")
        .select("id, user_id, type, title, meta, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.warn("[Activity] Failed to fetch events:", error.message);
        return [];
    }
    return data || [];
}
