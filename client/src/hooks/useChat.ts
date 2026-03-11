import { useState, useCallback } from "react";
import { api } from "@/lib/api";

const WELCOME_MESSAGE = {
    role: "assistant",
    content: `Hi there! 👋 I'm your AI career coach powered by Llama 3.3 & Gemini.

I can help you with:
• 📄 **Resume** — ATS optimization & fixes
• 💼 **Jobs** — Find relevant openings & apply strategy  
• 🧠 **Skill Gap** — What to learn for your target role
• 🎯 **Interviews** — DSA, system design & HR prep
• 🔗 **LinkedIn** — Profile optimization tips

What would you like to work on today?`,
};

export function useChat() {
    const [messages, setMessages] = useState<any[]>([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [provider, setProvider] = useState<string | null>(null);

    const sendMessage = useCallback(async (content: string | any[]) => {
        if (!content || isLoading) return;

        setError(null);
        const userMsg = { role: "user", content };

        // Optimistically add user message
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            // Only send actual chat messages (exclude welcome)
            const chatHistory = updatedMessages
                .filter((m) => !(m.role === "assistant" && m.content && typeof m.content === 'string' && m.content.includes("👋")))
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));

            const data = await api.post<any>("/api/chat", { messages: chatHistory });

            setProvider(data.provider);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.reply, provider: data.provider },
            ]);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
            // Remove the user message on error so they can retry
            setMessages(messages);
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading]);

    const clearChat = useCallback(() => {
        setMessages([WELCOME_MESSAGE]);
        setError(null);
        setProvider(null);
    }, []);

    return { messages, isLoading, error, provider, sendMessage, clearChat };
}
