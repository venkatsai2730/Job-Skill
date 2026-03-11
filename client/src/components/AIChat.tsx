import { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { Send, Paperclip, Image as ImageIcon, X, FileText } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

// Set pdfjs worker for Vite compatibility
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

const QUICK_PROMPTS = [
    { label: "Resume Audit", icon: "📊", text: "COMMAND: Perform a full 5-pillar Resume Audit. Give me an ATS score and identify all errors." },
    { label: "ATS Check", icon: "📄", text: "COMMAND: Run an ATS machine-readability check. Identify missing keywords for my role." },
    { label: "Find Jobs", icon: "💼", text: "COMMAND: Analyze my experience and recommend 5 job roles I should apply for now." },
    { label: "LinkedIn", icon: "🔗", text: "COMMAND: Create a professional LinkedIn Headline and About section for me." },
    { label: "Skill Gap", icon: "🧠", text: "COMMAND: Compare my resume against 2026 trends and give me a 3-step learning roadmap." },
];

function MessageBubble({ message }: { message: any }) {
    const isUser = message.role === "user";
    // Simple markdown-like formatting
    const formatText = (text: string) =>
        text
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/^• (.+)$/gm, "<li>$1</li>")
            .replace(/^- (.+)$/gm, "<li>$1</li>")
            .replace(/(<li>.*<\/li>)/gs, "<ul class='list-disc pl-4 space-y-1 my-1'>$1</ul>")
            .replace(/\n\n/g, "</p><p class='mt-2'>")
            .replace(/\n/g, "<br/>");

    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-electric flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                    JA
                </div>
            )}
            <div
                className={`max-w-[78%] rounded-2xl px-5 py-3 text-sm leading-relaxed
          ${isUser
                        ? "bg-blue-electric text-white rounded-br-sm"
                        : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-sm"
                    }`}
            >
                {isUser ? (
                    <div>
                        {Array.isArray(message.content) ? (
                            message.content.map((part: any, idx: number) => (
                                <div key={idx}>
                                    {part.type === 'text' && <p>{part.text}</p>}
                                    {part.type === 'image' && (
                                        <img
                                            src={`data:${part.mimeType};base64,${part.base64}`}
                                            alt="User upload"
                                            className="max-h-60 rounded-lg mt-2 border border-blue-electric/20 shadow-sm"
                                        />
                                    )}
                                </div>
                            ))
                        ) : (
                            <p>{message.content}</p>
                        )}
                    </div>
                ) : (
                    <div
                        dangerouslySetInnerHTML={{ __html: formatText(message.content) }}
                        className="prose prose-sm max-w-none text-gray-800"
                    />
                )}
                {message.provider && (
                    <span className="text-[10px] text-gray-400 mt-2 block text-right font-medium">
                        via {message.provider}
                    </span>
                )}
            </div>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-electric flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                JA
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 bg-blue-electric rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AIChat() {
    const { messages, isLoading, error, sendMessage, clearChat } = useChat();
    const [input, setInput] = useState("");
    const [attachments, setAttachments] = useState<any[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const isFirstMessage = messages.length <= 1;

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Handle initial prompt from URL
    useEffect(() => {
        if (isFirstMessage && !isLoading) {
            const params = new URLSearchParams(window.location.search);
            const initialPrompt = params.get("prompt");
            if (initialPrompt) {
                sendMessage(initialPrompt);
                // Clear the param from URL without refreshing
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            }
        }
    }, [isFirstMessage, isLoading, sendMessage]);

    const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;

        if (attachments.length > 0) {
            // Build multi-part message
            const parts: any[] = [];
            if (input.trim()) parts.push({ type: 'text', text: input.trim() });

            attachments.forEach(att => {
                if (att.type === 'image') {
                    parts.push({
                        type: 'image',
                        mimeType: att.mimeType,
                        base64: att.base64
                    });
                } else {
                    // Document text
                    parts.push({ type: 'text', text: `[File Content: ${att.name}]\n${att.text}` });
                }
            });

            sendMessage(parts);
        } else {
            sendMessage(input.trim());
        }

        setInput("");
        setAttachments([]); // Clear from tray but they stay in Chat History
        inputRef.current?.focus();
    };

    const handleQuickPrompt = (text: string) => {
        if (isLoading) return;

        if (attachments.length > 0) {
            const parts: any[] = [{ type: 'text', text }];
            attachments.forEach(att => {
                if (att.type === 'image') {
                    parts.push({ type: 'image', mimeType: att.mimeType, base64: att.base64 });
                } else {
                    parts.push({ type: 'text', text: `[File Content: ${att.name}]\n${att.text}` });
                }
            });
            sendMessage(parts);
            setAttachments([]); // Clear tray, now in history
        } else {
            sendMessage(text);
        }
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-display font-bold text-gray-900">AI Career Coach</h1>
                    <p className="text-sm text-gray-500">Powered by Llama 3.3 & Gemini 2.0</p>
                </div>
                <button
                    onClick={clearChat}
                    className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200
                     rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors bg-white shadow-sm"
                >
                    New Chat
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-4xl mx-auto w-full">
                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}
                {isLoading && <TypingIndicator />}
                {error && (
                    <div className="text-center">
                        <span className="text-xs text-red-400 bg-red-900/20 px-3 py-1.5 rounded-full border border-red-500/20">
                            ⚠️ {error}
                        </span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Quick Prompts — only on first load */}
            {isFirstMessage && (
                <div className="max-w-4xl mx-auto w-full px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                        {QUICK_PROMPTS.map((p) => (
                            <button
                                key={p.label}
                                onClick={() => handleQuickPrompt(p.text)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full
                           border border-blue-electric/30 text-blue-electric bg-white
                           hover:bg-blue-electric/10
                           transition-colors disabled:opacity-50 shadow-sm"
                            >
                                <span>{p.icon}</span> {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="bg-white border-t border-gray-200 px-4 py-4">
                {/* Attachments Tray */}
                {attachments.length > 0 && (
                    <div className="max-w-4xl mx-auto flex flex-wrap gap-2 mb-3">
                        {attachments.map((att, i) => (
                            <div key={i} className="relative group flex items-center gap-2 bg-blue-electric/5 border border-blue-electric/20 rounded-lg px-3 py-2 text-xs text-blue-electric font-medium">
                                {att.type === 'image' ? (
                                    <div className="w-8 h-8 rounded overflow-hidden">
                                        <img src={`data:${att.mimeType};base64,${att.base64}`} alt="preview" className="w-full h-full object-cover" />
                                    </div>
                                ) : <FileText className="w-4 h-4" />}
                                <span className="max-w-[100px] truncate">{att.name}</span>
                                <button
                                    onClick={() => removeAttachment(i)}
                                    className="p-1 hover:bg-blue-electric/10 rounded-full transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="max-w-4xl mx-auto flex items-end gap-2 bg-gray-50 border border-gray-300 rounded-2xl px-2 py-2 focus-within:border-blue-electric focus-within:ring-2 focus-within:ring-blue-electric/20 transition-colors">
                    <div className="flex flex-col gap-1">
                        <button
                            type="button"
                            onClick={() => document.getElementById('chat-doc-upload')?.click()}
                            className="p-2 text-gray-400 hover:text-blue-electric transition-colors focus:outline-none"
                            title="Upload Resume (PDF, DOCX, TXT)"
                        >
                            <Paperclip className="w-5 h-5 cursor-pointer" />
                            <input
                                type="file"
                                id="chat-doc-upload"
                                className="hidden"
                                accept=".txt,.md,.pdf,.docx"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const fileName = file.name.toLowerCase();
                                    try {
                                        let text = "";
                                        if (fileName.endsWith(".pdf")) {
                                            const arrayBuffer = await file.arrayBuffer();
                                            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                                            let fullText = "";
                                            for (let i = 1; i <= pdf.numPages; i++) {
                                                const page = await pdf.getPage(i);
                                                const textContent = await page.getTextContent();
                                                fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
                                            }
                                            text = fullText.trim();
                                        } else if (fileName.endsWith(".docx")) {
                                            const arrayBuffer = await file.arrayBuffer();
                                            const result = await mammoth.extractRawText({ arrayBuffer });
                                            text = result.value.trim();
                                        } else {
                                            text = await file.text();
                                        }
                                        setAttachments(prev => [...prev, { type: 'document', name: file.name, text }]);
                                    } catch (err: any) {
                                        alert(`Failed to read document: ${err.message}`);
                                    }
                                    e.target.value = "";
                                }}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => document.getElementById('chat-img-upload')?.click()}
                            className="p-2 text-gray-400 hover:text-blue-electric transition-colors focus:outline-none"
                            title="Upload Image (Job Post screenshot, Profile, etc.)"
                        >
                            <ImageIcon className="w-5 h-5 cursor-pointer" />
                            <input
                                type="file"
                                id="chat-img-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                        const base64 = (ev.target?.result as string).split(',')[1];
                                        setAttachments(prev => [...prev, {
                                            type: 'image',
                                            name: file.name,
                                            mimeType: file.type,
                                            base64
                                        }]);
                                    };
                                    reader.readAsDataURL(file);
                                    e.target.value = "";
                                }}
                            />
                        </button>
                    </div>

                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask your AI career coach... (Enter to send)"
                        rows={1}
                        disabled={isLoading}
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-900
                       focus:outline-none resize-none max-h-32 disabled:opacity-50 placeholder:text-gray-500"
                        style={{ minHeight: "40px" }}
                        onInput={(e: any) => {
                            e.target.style.height = "40px";
                            e.target.style.height = e.target.scrollHeight + "px";
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && attachments.length === 0)}
                        className="bg-blue-electric text-white rounded-xl p-3 h-10 w-10
                       hover:bg-blue-bright disabled:opacity-40
                       transition-colors flex items-center justify-center flex-shrink-0 focus:outline-none mb-1"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                </div>
                <p className="text-center text-[11px] text-gray-500 mt-2">
                    Press Enter to send • Shift+Enter for new line
                </p>
            </div>
        </div>
    );
}
