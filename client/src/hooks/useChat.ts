import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type AIFeature = "chat" | "resume_pdf" | "resume_image" | "cover_letter" | "job_match" | "agent" | "screening" | "notification" | "code_gen";

export interface ChatMessage {
    id?: string;
    role: "user" | "assistant";
    content: string | any[];
    provider?: string;
    model?: string;
    feature?: string;
    dataPayload?: any; // NEW for Phase 5 Intents
    created_at?: string;
}

export interface Conversation {
    id: string;
    title: string;
    last_message_at: string;
    created_at: string;
}

const WELCOME_MESSAGE: ChatMessage = {
    role: "assistant",
    content: `Hey there! 👋 I'm your AI career assistant.

Here's what I can do:

📊 **Resume Audit** — ATS score & deep analysis
💼 **Find Jobs** — Real-time from Greenhouse & Lever APIs
✍️ **Cover Letter** — Tailored to any job
📋 **Screening Q&A** — Auto-answer application questions
🧠 **Skill Gap** — 2026 market roadmap
🔗 **LinkedIn** — Profile optimization
💻 **Code Help** — Code generation & review
🎯 **Job Match** — AI-powered scoring

What would you like to work on?`,
};

export function useChat() {
    const { token } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [provider, setProvider] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Load conversation list
    const loadConversations = useCallback(async () => {
        if (!token) return;
        try {
            const data = await api.get<{ conversations: Conversation[] }>("/api/chat/conversations");
            setConversations(data.conversations || []);
        } catch { /* ignore if not logged in */ }
    }, [token]);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    // Load a specific conversation's messages
    const loadConversation = useCallback(async (convId: string) => {
        if (!token) return;
        setLoadingHistory(true);
        try {
            const data = await api.get<{ messages: ChatMessage[] }>(`/api/chat/conversations/${convId}/messages`);
            setMessages(data.messages.length > 0 ? data.messages : [WELCOME_MESSAGE]);
            setActiveConversationId(convId);
        } catch (err: any) {
            setError("Failed to load conversation.");
        } finally {
            setLoadingHistory(false);
        }
    }, [token]);

    // Send message (works with or without persistent history)
    const sendMessage = useCallback(async (content: string | any[], feature: AIFeature = "chat") => {
        if (!content || isLoading) return;
        setError(null);

        const userMsg: ChatMessage = { role: "user", content };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            let result: any;

            if (token && activeConversationId) {
                // Persistent mode — use conversation endpoint
                result = await api.post<any>(`/api/chat/conversations/${activeConversationId}/messages`, {
                    content,
                    feature,
                });
            } else if (token && !activeConversationId) {
                // Create new conversation first
                const convData = await api.post<{ conversation: Conversation }>("/api/chat/conversations", {
                    title: typeof content === "string" ? content.substring(0, 60) : "New Chat",
                });
                const newConvId = convData.conversation?.id;
                if (newConvId) {
                    setActiveConversationId(newConvId);
                    result = await api.post<any>(`/api/chat/conversations/${newConvId}/messages`, {
                        content,
                        feature,
                    });
                    loadConversations(); // refresh sidebar
                }
            }

            if (!result) {
                // Fallback: stateless mode
                const chatHistory = updatedMessages
                    .filter(m => !(m.role === "assistant" && typeof m.content === "string" && m.content.includes("👋")))
                    .map(m => ({ role: m.role, content: m.content }));
                result = await api.post<any>("/api/chat", { messages: chatHistory, feature });
            }

            setProvider(result.provider);
            setMessages(prev => [
                ...prev,
                { role: "assistant", content: result.reply, provider: result.provider, model: result.model, dataPayload: result.dataPayload },
            ]);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
            setMessages(messages); // rollback
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading, token, activeConversationId, loadConversations]);

    const clearChat = useCallback(() => {
        setMessages([WELCOME_MESSAGE]);
        setError(null);
        setProvider(null);
        setActiveConversationId(null);
    }, []);

    const deleteConversation = useCallback(async (convId: string) => {
        if (!token) return;
        try {
            await api.delete(`/api/chat/conversations/${convId}`);
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (activeConversationId === convId) clearChat();
        } catch { /* ignore */ }
    }, [token, activeConversationId, clearChat]);

    const renameConversation = useCallback(async (convId: string, title: string) => {
        if (!token) return;
        try {
            await api.patch(`/api/chat/conversations/${convId}`, { title });
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
        } catch { /* ignore */ }
    }, [token]);

    return {
        messages, isLoading, error, provider, sendMessage, clearChat,
        conversations, activeConversationId, loadConversation,
        deleteConversation, renameConversation, loadingHistory,
    };
}
