// ═══════════════════════════════════════════════════════════════
// Smart Notification Service — AI-filtered job alerts
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";

export interface Notification {
    id?: string;
    user_id: string;
    type: "job_match" | "application_update" | "system";
    title: string;
    message: string;
    data?: any;
    read: boolean;
    created_at?: string;
}

export async function createNotification(notification: Omit<Notification, "id" | "read" | "created_at">) {
    const { data, error } = await supabaseAdmin
        .from("notifications")
        .insert({ ...notification, read: false })
        .select()
        .single();

    if (error) {
        console.error("[Notifications] Failed to create:", error.message);
        return null;
    }
    return data;
}

export async function getUserNotifications(userId: string, limit = 20) {
    const { data, error } = await supabaseAdmin
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
}

export async function markAsRead(notificationId: string, userId: string) {
    const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);

    if (error) throw new Error(error.message);
}

export async function markAllRead(userId: string) {
    const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

    if (error) throw new Error(error.message);
}

export async function getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);

    if (error) return 0;
    return count || 0;
}
