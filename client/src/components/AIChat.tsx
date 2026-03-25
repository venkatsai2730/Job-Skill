import { useState, useRef, useEffect } from "react";
import { useChat, type AIFeature, type Conversation } from "../hooks/useChat";
import {
    Send, Paperclip, Image as ImageIcon, X, FileText, Plus,
    MessageSquare, Trash2, MoreHorizontal, Loader2, Code, FileEdit,
    Target, HelpCircle, Sparkles, ChevronLeft, ChevronRight, PenLine,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
).toString();

const QUICK_PROMPTS = [
    { label: "Score Resume", icon: "📊", feature: "chat" as AIFeature, text: "/score" },
    { label: "Find Jobs", icon: "💼", feature: "chat" as AIFeature, text: "/jobs" },
    { label: "Fix Bullets", icon: "🔧", feature: "chat" as AIFeature, text: "/fix" },
    { label: "Cover Letter", icon: "✍️", feature: "cover_letter" as AIFeature, text: "/cover" },
    { label: "Interview Prep", icon: "🎤", feature: "chat" as AIFeature, text: "/prep" },
    { label: "Skill Gaps", icon: "🧠", feature: "chat" as AIFeature, text: "/skills" },
    { label: "LinkedIn", icon: "🔗", feature: "chat" as AIFeature, text: "/linkedin" },
    { label: "All Commands", icon: "📋", feature: "chat" as AIFeature, text: "/help" },
];

function ModelBadge({ provider, model }: { provider?: string; model?: string }) {
    return null;
}

function formatMarkdown(text: string) {
    return text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-surface-3 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-emerald-300 border border-white/[0.06]"><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code class="bg-surface-3 px-1.5 py-0.5 rounded text-emerald-300 text-sm font-mono">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>")
        .replace(/^### (.+)$/gm, "<h3 class='text-foreground font-semibold text-base mt-3 mb-1'>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2 class='text-foreground font-semibold text-lg mt-4 mb-1'>$1</h2>")
        .replace(/^[•\-] (.+)$/gm, "<li class='ml-4'>$1</li>")
        .replace(/^\d+\.\s(.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
        .replace(/\n\n/g, "</p><p class='mt-2'>")
        .replace(/\n/g, "<br/>");
}

function MessageBubble({ message }: { message: any }) {
    const isUser = message.role === "user";
    const payload = message.dataPayload;
    
    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
            {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-pulse to-blue-electric flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1 shadow-lg shadow-violet-pulse/20">
                    ✦
                </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${isUser
                ? "bg-blue-electric text-white rounded-br-md shadow-lg shadow-blue-electric/20"
                : "bg-surface-1 text-white-90 border border-white/[0.06] rounded-bl-md"}`}>
                
                {isUser ? (
                    <div>
                        {Array.isArray(message.content) ? message.content.map((part: any, idx: number) => (
                            <div key={idx}>
                                {part.type === "text" && <p>{part.text}</p>}
                                {part.type === "image" && <img src={`data:${part.mimeType};base64,${part.base64}`} alt="Upload" className="max-h-60 rounded-lg mt-2 border border-white/20" />}
                            </div>
                        )) : <p>{message.content}</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(String(message.content)) }}
                            className="prose prose-sm prose-invert max-w-none [&_li]:text-white-80" />
                            
                        {/* PHASE 5 INTENT RENDERING */}
                        {payload && payload.type === "score" && payload.data && (
                            <div className="bg-surface-2 border border-blue-electric/20 rounded-xl p-4 mt-3 flex flex-col gap-3 shadow-lg shadow-blue-electric/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-white-60 text-xs uppercase tracking-wider font-semibold">Live ATS Score</span>
                                    <span className={`text-xl font-display font-bold ${payload.data.ats_score > 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {payload.data.ats_score}<span className="text-xs text-white-40">/100</span>
                                    </span>
                                </div>
                                {payload.data.issues?.length > 0 && (
                                     <div className="space-y-1.5 mt-1 border-t border-white/5 pt-3">
                                         <p className="text-[10px] text-white-40 uppercase tracking-widest">Detected Issues</p>
                                         {payload.data.issues.slice(0, 3).map((issue: string, idx: number) => (
                                             <div key={idx} className="flex gap-2 text-xs">
                                                 <span className="text-amber-400 shrink-0">⚠️</span>
                                                 <span className="text-white-80">{issue}</span>
                                             </div>
                                         ))}
                                     </div>
                                )}
                            </div>
                        )}
                        
                        {payload && payload.type === "latex" && payload.data && (
                            <div className="bg-surface-2 border border-white/10 rounded-xl p-4 mt-3">
                                <div className="flex items-center justify-between mb-2">
                                     <span className="text-white-60 text-xs font-semibold uppercase">LaTeX Source</span>
                                     <button 
                                        onClick={() => navigator.clipboard.writeText(payload.data)}
                                        className="text-white-40 hover:text-white bg-surface-3 px-2 py-1 rounded text-[10px] transition-colors"
                                     >
                                         Copy Code
                                     </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto rounded bg-surface-3 p-3">
                                    <pre className="text-[10px] text-blue-300 font-mono">
                                        <code>{payload.data}</code>
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {message.provider && (
                    <div className="mt-2 flex justify-end">
                        <ModelBadge provider={message.provider} model={message.model} />
                    </div>
                )}
            </div>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-pulse to-blue-electric flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-violet-pulse/20">JS</div>
            <div className="bg-surface-1 border border-white/[0.06] rounded-2xl rounded-bl-md px-5 py-3.5">
                <div className="flex gap-1.5 items-center h-5">
                    {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-blue-electric rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    <span className="text-white-40 text-xs ml-2">Aria is thinking...</span>
                </div>
            </div>
        </div>
    );
}

function ConversationItem({ conv, isActive, onSelect, onDelete, onRename }: {
    conv: Conversation; isActive: boolean; onSelect: () => void; onDelete: () => void; onRename: (t: string) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(conv.title);
    const handleRename = () => { if (editTitle.trim()) onRename(editTitle.trim()); setEditing(false); };

    return (
        <div className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm
            ${isActive ? "bg-blue-electric/10 text-blue-electric border border-blue-electric/20" : "text-white-60 hover:bg-surface-2 hover:text-foreground border border-transparent"}`}
            onClick={() => !editing && onSelect()}>
            <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
            {editing ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onBlur={handleRename} onKeyDown={e => e.key === "Enter" && handleRename()}
                    className="flex-1 bg-transparent text-foreground text-sm outline-none border-b border-blue-electric/50"
                    autoFocus onClick={e => e.stopPropagation()} />
            ) : <span className="flex-1 truncate text-[13px] font-medium">{conv.title}</span>}
            <div className="relative">
                <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-3 transition-all">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                    <div className="absolute right-0 top-7 bg-surface-2 border border-white/[0.08] rounded-lg shadow-xl z-50 py-1 min-w-[120px]"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditing(true); setShowMenu(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-white-60 hover:bg-surface-3 hover:text-foreground flex items-center gap-2">
                            <PenLine className="w-3 h-3" /> Rename
                        </button>
                        <button onClick={() => { onDelete(); setShowMenu(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                            <Trash2 className="w-3 h-3" /> Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AIChat() {
    const {
        messages, isLoading, error, sendMessage, clearChat,
        conversations, activeConversationId, loadConversation,
        deleteConversation, renameConversation, loadingHistory,
    } = useChat();

    const [input, setInput] = useState("");
    const [attachments, setAttachments] = useState<any[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeFeature, setActiveFeature] = useState<AIFeature>("chat");
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const isFirstMessage = messages.length <= 1;

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

    useEffect(() => {
        if (isFirstMessage && !isLoading) {
            const p = new URLSearchParams(window.location.search).get("prompt");
            if (p) { sendMessage(p, activeFeature); window.history.replaceState({}, "", window.location.pathname); }
        }
    }, [isFirstMessage, isLoading, sendMessage, activeFeature]);

    const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;
        if (attachments.length > 0) {
            const parts: any[] = [];
            if (input.trim()) parts.push({ type: "text", text: input.trim() });
            attachments.forEach(att => {
                if (att.type === "image") parts.push({ type: "image", mimeType: att.mimeType, base64: att.base64 });
                else parts.push({ type: "text", text: `[File Content: ${att.name}]\n${att.text}` });
            });
            sendMessage(parts, activeFeature);
        } else { sendMessage(input.trim(), activeFeature); }
        setInput(""); setAttachments([]); inputRef.current?.focus();
    };

    const handleQuickPrompt = (text: string, feature: AIFeature) => {
        if (isLoading) return;
        setActiveFeature(feature);
        sendMessage(text, feature);
    };

    const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));
    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    const featureLabels: Record<string, { icon: any; label: string }> = {
        chat: { icon: MessageSquare, label: "Chat" },
        cover_letter: { icon: FileEdit, label: "Cover Letter" },
        code_gen: { icon: Code, label: "Code" },
        job_match: { icon: Target, label: "Job Match" },
        screening: { icon: HelpCircle, label: "Q&A" },
    };

    const handleFileUpload = async (file: File, type: "doc" | "img") => {
        if (type === "img") {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = (ev.target?.result as string).split(",")[1];
                setAttachments(prev => [...prev, { type: "image", name: file.name, mimeType: file.type, base64 }]);
            };
            reader.readAsDataURL(file);
            return;
        }
        const fn = file.name.toLowerCase();
        try {
            let text = "";
            if (fn.endsWith(".pdf")) {
                const ab = await file.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: ab }).promise;
                let ft = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const pg = await pdf.getPage(i);
                    const tc = await pg.getTextContent();
                    ft += tc.items.map((item: any) => item.str).join(" ") + "\n";
                }
                text = ft.trim();
            } else if (fn.endsWith(".docx")) {
                const ab = await file.arrayBuffer();
                const r = await mammoth.extractRawText({ arrayBuffer: ab });
                text = r.value.trim();
            } else { text = await file.text(); }
            setAttachments(prev => [...prev, { type: "document", name: file.name, text }]);
        } catch (err: any) { alert(`Failed to read: ${err.message}`); }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-page">
            {/* Sidebar */}
            <div className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden border-r border-white/[0.06] bg-surface-1 flex flex-col shrink-0`}>
                <div className="p-3 border-b border-white/[0.06]">
                    <button onClick={clearChat}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-electric/10 text-blue-electric hover:bg-blue-electric/20 transition-all text-sm font-semibold border border-blue-electric/20">
                        <Plus className="w-4 h-4" /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                    {conversations.length === 0 ? (
                        <p className="text-white-30 text-xs text-center py-8">No conversations yet</p>
                    ) : conversations.map(conv => (
                        <ConversationItem key={conv.id} conv={conv}
                            isActive={conv.id === activeConversationId}
                            onSelect={() => loadConversation(conv.id)}
                            onDelete={() => deleteConversation(conv.id)}
                            onRename={(t) => renameConversation(conv.id, t)} />
                    ))}
                </div>
                <div className="p-3 border-t border-white/[0.06]">
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-4xl mx-auto w-full">
                    {loadingHistory ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 text-blue-electric animate-spin" />
                            <p className="text-white-40 text-sm">Loading conversation...</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
                            {isLoading && <TypingIndicator />}
                            {error && (
                                <div className="text-center">
                                    <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">⚠️ {error}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Quick Prompts */}
                {isFirstMessage && (
                    <div className="max-w-4xl mx-auto w-full px-4 pb-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {QUICK_PROMPTS.map(p => (
                                <button key={p.label} onClick={() => handleQuickPrompt(p.text, p.feature)} disabled={isLoading}
                                    className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl border border-white/[0.06] text-white-60 bg-surface-1 hover:bg-surface-2 hover:text-foreground hover:border-blue-electric/30 transition-all disabled:opacity-50 text-left">
                                    <span className="text-base">{p.icon}</span>
                                    <span className="font-medium">{p.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="bg-surface-1 border-t border-white/[0.06] px-4 py-3">
                    {attachments.length > 0 && (
                        <div className="max-w-4xl mx-auto flex flex-wrap gap-2 mb-3">
                            {attachments.map((att, i) => (
                                <div key={i} className="flex items-center gap-2 bg-blue-electric/10 border border-blue-electric/20 rounded-lg px-3 py-2 text-xs text-blue-electric font-medium">
                                    {att.type === "image" ? (
                                        <div className="w-8 h-8 rounded overflow-hidden"><img src={`data:${att.mimeType};base64,${att.base64}`} alt="" className="w-full h-full object-cover" /></div>
                                    ) : <FileText className="w-4 h-4" />}
                                    <span className="max-w-[100px] truncate">{att.name}</span>
                                    <button onClick={() => removeAttachment(i)} className="p-0.5 hover:bg-blue-electric/10 rounded-full"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="max-w-4xl mx-auto flex items-end gap-2 bg-surface-2 border border-white/[0.06] rounded-2xl px-2 py-2 focus-within:border-blue-electric/50 focus-within:ring-2 focus-within:ring-blue-electric/20 transition-all">
                        <div className="flex flex-col gap-0.5">
                            <button type="button" onClick={() => document.getElementById("chat-doc-upload")?.click()}
                                className="p-2 text-white-40 hover:text-blue-electric transition-colors" title="Upload Resume">
                                <Paperclip className="w-5 h-5" />
                                <input type="file" id="chat-doc-upload" className="hidden" accept=".txt,.md,.pdf,.docx"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "doc"); e.target.value = ""; }} />
                            </button>
                            <button type="button" onClick={() => document.getElementById("chat-img-upload")?.click()}
                                className="p-2 text-white-40 hover:text-blue-electric transition-colors" title="Upload Image">
                                <ImageIcon className="w-5 h-5" />
                                <input type="file" id="chat-img-upload" className="hidden" accept="image/*"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "img"); e.target.value = ""; }} />
                            </button>
                        </div>
                        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                            placeholder={activeFeature === "code_gen" ? "Describe the code you need..." : activeFeature === "cover_letter" ? "Paste job description for cover letter..." : "Ask me anything... (Enter to send)"}
                            rows={1} disabled={isLoading}
                            className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none resize-none max-h-32 disabled:opacity-50 placeholder:text-white-30"
                            style={{ minHeight: "40px" }}
                            onInput={(e: any) => { e.target.style.height = "40px"; e.target.style.height = e.target.scrollHeight + "px"; }} />
                        <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)}
                            className="bg-blue-electric text-white rounded-xl p-3 h-10 w-10 hover:bg-blue-bright disabled:opacity-40 transition-colors flex items-center justify-center flex-shrink-0 mb-1">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-white-30 mt-1.5">Enter to send · Shift+Enter for new line</p>
                </div>
            </div>
        </div>
    );
}
