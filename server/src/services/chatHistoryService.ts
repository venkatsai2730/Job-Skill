// ═══════════════════════════════════════════════════════════════
// Chat History Service — Persistent conversation storage
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";

export interface ChatConversation {
    id?: string;
    user_id: string;
    title: string;
    last_message_at?: string;
    created_at?: string;
}

export interface ChatMessage {
    id?: string;
    conversation_id: string;
    role: "user" | "assistant";
    content: string;
    provider?: string;
    model?: string;
    feature?: string;
    tokens?: number;
    created_at?: string;
}

// ── Conversations ───────────────────────────────────────────

export async function createConversation(userId: string, title: string): Promise<ChatConversation | null> {
    const { data, error } = await supabaseAdmin
        .from("chat_conversations")
        .insert({ user_id: userId, title })
        .select()
        .single();
    if (error) { console.error("[ChatHistory] Create conv error:", error.message); return null; }
    return data;
}

export async function getUserConversations(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
        .from("chat_conversations")
        .select("id, title, last_message_at, created_at")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
}

export async function deleteConversation(conversationId: string, userId: string) {
    // Delete messages first
    await supabaseAdmin.from("chat_messages").delete().eq("conversation_id", conversationId);
    const { error } = await supabaseAdmin
        .from("chat_conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", userId);
    if (error) throw new Error(error.message);
}

export async function renameConversation(conversationId: string, userId: string, title: string) {
    const { error } = await supabaseAdmin
        .from("chat_conversations")
        .update({ title })
        .eq("id", conversationId)
        .eq("user_id", userId);
    if (error) throw new Error(error.message);
}

// ── Messages ────────────────────────────────────────────────

export async function addMessage(msg: Omit<ChatMessage, "id" | "created_at">): Promise<ChatMessage | null> {
    const { data, error } = await supabaseAdmin
        .from("chat_messages")
        .insert(msg)
        .select()
        .single();

    if (error) { console.error("[ChatHistory] Add message error:", error.message); return null; }

    // Update conversation last_message_at
    await supabaseAdmin
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", msg.conversation_id);

    return data;
}

export async function getConversationMessages(conversationId: string, limit = 100) {
    const { data, error } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
}

// Auto-generate title from first user message
// Maps slash commands to readable titles, and truncates regular messages
export function generateTitle(firstMessage: string): string {
    const clean = typeof firstMessage === "string" ? firstMessage.trim() : "New Chat";
    if (!clean) return "New Chat";

    // Map slash commands to meaningful titles
    const COMMAND_TITLES: Record<string, string> = {
        "/jobs":             "Job Search & Matches",
        "/score":            "Resume Score Analysis",
        "/fix":              "Resume Bullet Fixes",
        "/draft":            "Full Resume Draft",
        "/rewrite summary":  "Summary Rewrite",
        "/rewrite":          "Resume Rewrite",
        "/cover":            "Cover Letter",
        "/prep":             "Interview Preparation",
        "/help":             "Help & Commands",
        "/match":            "Job Match Analysis",
        "/linkedin":         "LinkedIn Optimization",
        "/skills":           "Skills Analysis",
    };

    // Check if the message starts with a slash command
    const lowerClean = clean.toLowerCase();
    for (const [cmd, title] of Object.entries(COMMAND_TITLES)) {
        if (lowerClean === cmd || lowerClean.startsWith(cmd + " ")) {
            // If there's text after the command, append it
            const rest = clean.substring(cmd.length).trim();
            if (rest && rest.length > 3) {
                return `${title}: ${rest.substring(0, 40)}`;
            }
            return title;
        }
    }

    // For regular messages, use first 60 chars
    return clean.substring(0, 60).replace(/\n/g, " ").trim() || "New Chat";
}
