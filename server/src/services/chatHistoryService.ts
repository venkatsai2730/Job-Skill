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
export function generateTitle(firstMessage: string): string {
    const clean = typeof firstMessage === "string" ? firstMessage : "New Chat";
    return clean.substring(0, 60).replace(/\n/g, " ").trim() || "New Chat";
}
