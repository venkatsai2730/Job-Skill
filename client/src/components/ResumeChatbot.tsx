import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, User, Loader2, Target, CheckCircle2, Search, Wand2, Plus, Sparkles, MessageSquare } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: "user" | "bot";
    content: string;
    command?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any; // To store complex JSON payloads like ATS scores or generated bullets
}

interface ChatbotResponse {
    message: string;
    command: string;
    data: any;
}

interface ResumeChatbotProps {
    hasParsedResume: boolean;
    jobDescription: string;
}

// ── Component ────────────────────────────────────────────
export function ResumeChatbot({ hasParsedResume, jobDescription }: ResumeChatbotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: "1",
        role: "bot",
        content: "Hi! I'm your Resume AI built to optimize your profile. Try commands like `/score`, `/fix`, or `/create`."
    }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    // Auto-scroll chat to bottom
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // ── Handlers ─────────────────────────────────────────
    const handleSend = async (text: string = input, autoCmd?: string) => {
        if (!text.trim() && !autoCmd) return;

        const messageText = autoCmd ? autoCmd : text.trim();
        const userMsgId = Date.now().toString();

        // Add user message to UI immediately
        setMessages(prev => [...prev, { id: userMsgId, role: "user", content: messageText }]);
        setInput("");
        setLoading(true);

        try {
            // Determine explicit command vs extracted
            const explicitCommand = autoCmd ? autoCmd.replace("/", "") : undefined;

            const res = await api.post<ChatbotResponse>("/api/chatbot/resume-chatbot", {
                message: messageText,
                command: explicitCommand,
                payload: {
                    jobDescription: jobDescription || undefined,
                    // Note: intentionally omitting resumeText to let the backend auto-fetch it from the DB
                }
            });

            // Add bot response
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: res.data.message || "Here is what I found:",
                command: res.data.command,
                data: res.data.data
            }]);

        } catch (err: unknown) {
            console.error("Chatbot API Error:", err);

            // Safe type casting for Axios-like error objects
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorObj = err as any;
            const errorMsg = errorObj?.response?.data?.message || "Something went wrong communicating with the AI. Please try again.";

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: `⚠️ ${errorMsg}`
            }]);
            toast.error("Chatbot failed to respond.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Quick Action Buttons ──────────────────────────────
    const quickActions = [
        { cmd: "/score", icon: <Target className="w-3.5 h-3.5" />, label: "Score ATS" },
        { cmd: "/fix", icon: <Wand2 className="w-3.5 h-3.5" />, label: "Fix Grammar" },
        { cmd: "/create", icon: <Plus className="w-3.5 h-3.5" />, label: "Create Bullets" },
        { cmd: "/latex", icon: <Bot className="w-3.5 h-3.5" />, label: "Unbreakable PDF" },
        { cmd: "/predict-questions", icon: <Sparkles className="w-3.5 h-3.5" />, label: "Interview Prep" }
    ];

    // ── Render Helpers ────────────────────────────────────
    const renderComplexData = (msg: ChatMessage) => {
        if (!msg.data) return null;

        // 1. ATS Score Results
        if (msg.command === "score" && msg.data.greenhouse && msg.data.lever) {
            return (
                <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-md border border-white/5 bg-surface-3">
                        <span className="text-white-80">Greenhouse Score</span>
                        <span className="font-bold text-emerald-400">{msg.data.greenhouse.overallScore}/100</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md border border-white/5 bg-surface-3">
                        <span className="text-white-80">Lever Score</span>
                        <span className="font-bold text-blue-400">{msg.data.lever.overallScore}/100</span>
                    </div>
                    {msg.data.greenhouse.fields.keywords?.status === "warning" && (
                        <p className="text-rose-400 mt-2 px-1">Warning: Missing key ATS keywords from JD.</p>
                    )}
                    {msg.data.greenhouse.fields.bulletAnalysis && (
                        <div className="flex items-start justify-between p-2 mt-2 rounded-md border border-white/5 bg-surface-3">
                            <span className="text-white-80">Bullet Impact Score</span>
                            <div className="text-right">
                                <span className={`font-bold ${msg.data.greenhouse.fields.bulletAnalysis.overallScore >= 75 ? 'text-emerald-400' : msg.data.greenhouse.fields.bulletAnalysis.overallScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {msg.data.greenhouse.fields.bulletAnalysis.overallScore}/100
                                </span>
                                <p className="text-[9px] text-white-40 mt-0.5">{msg.data.greenhouse.fields.bulletAnalysis.suggestion}</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // 2. Fixed Bullets
        if (msg.command === "fix" && msg.data.improvedBullets?.length > 0) {
            return (
                <div className="mt-3 space-y-3">
                    {msg.data.improvedBullets.map((b: { original: string; improved: string; addedKeywords?: string[] }, i: number) => (
                        <div key={i} className="bg-surface-3 p-3 rounded-lg border border-white/5 text-[11px]">
                            <p className="text-rose-400/80 mb-2 line-through decoration-rose-500/50">"{b.original}"</p>
                            <div className="flex items-start gap-1.5 leading-relaxed text-emerald-100">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{b.improved}</span>
                            </div>
                            {b.addedKeywords && b.addedKeywords.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {b.addedKeywords.map((kw: string) => (
                                        <span key={kw} className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-[4px] font-medium text-[9px]">{kw}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        // 3. Created Bullets
        if (msg.command === "create" && msg.data.generatedBullets?.length > 0) {
            return (
                <div className="mt-3 space-y-2">
                    {msg.data.generatedBullets.map((b: { bullet: string; focus: string }, i: number) => (
                        <div key={i} className="bg-surface-3 p-2.5 rounded-lg border border-white/5 text-[11px] leading-relaxed group relative cursor-pointer hover:border-indigo-500/30 transition-colors">
                            <span className="text-white-80">{b.bullet}</span>
                            <div className="mt-1.5 flex justify-between items-center opacity-40">
                                <span className="text-[9px] uppercase tracking-wider">{b.focus}</span>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // 4. Interview Questions
        if (msg.command === "predict-questions" && msg.data.categories?.length > 0) {
            return (
                <div className="mt-3 space-y-2">
                    <p className="text-xs text-white-60">Generated {msg.data.categories.length} question categories. Scroll up to the Interview Prep panel in the main UI to dive deep into the answers!</p>
                </div>
            );
        }

        // 5. LaTeX Compiler
        if (msg.command === "latex" && msg.data?.latex) {
            return (
                <div className="mt-3">
                    <p className="text-[11px] text-emerald-400 mb-2 font-medium">ATS-Unbreakable LaTeX Generated:</p>
                    <div className="relative group mt-1">
                        <textarea
                            readOnly
                            className="w-full h-32 bg-[#0d0d12] border border-white/10 rounded-lg p-2.5 text-[10px] font-mono text-white-60 resize-none outline-none scrollbar-thin scrollbar-thumb-white/10 overflow-y-auto"
                            value={msg.data.latex}
                        />
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(msg.data.latex);
                                toast.success("LaTeX copied to clipboard!");
                            }}
                            className="absolute top-2 right-2 px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-500/30"
                        >
                            Copy text
                        </button>
                    </div>
                    <p className="text-[9.5px] text-white-40 leading-relaxed mt-2">Paste this directly into Overleaf or compile locally with pdflatex for a 100% flawless single-column PDF parse.</p>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            {/* Floating Action Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-500 text-white shadow-xl shadow-indigo-500/25 flex items-center justify-center z-40 transition-shadow ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                <Bot className="w-6 h-6" />
                {!hasParsedResume && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                )}
            </motion.button>

            {/* Chatbot Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-6 right-6 w-[380px] h-[550px] max-h-[80vh] flex flex-col bg-surface border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/5 bg-surface-2 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-500/10">
                                    <Bot className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">AI Career Coach</h3>
                                    <p className="text-[10px] text-white-40">{hasParsedResume ? "Resume connected" : "Awaiting resume..."}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/5 rounded-md text-white-40 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface/50 scrollbar-none">
                            <AnimatePresence initial={false}>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "items-start"}`}
                                    >
                                        <div className={`
                                            p-3 rounded-2xl text-sm leading-relaxed
                                            ${msg.role === "user"
                                                ? "bg-indigo-500 text-white rounded-tr-sm"
                                                : "bg-surface-2 text-white-80 border border-white/5 rounded-tl-sm"}
                                        `}>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            {renderComplexData(msg)}
                                        </div>
                                        <span className={`text-[9px] text-white-30 mt-1 capitalize ${msg.role === "user" ? "text-right" : ""}`}>
                                            {msg.role} {msg.command && `• /${msg.command}`}
                                        </span>
                                    </motion.div>
                                ))}

                                {loading && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex max-w-[80%]">
                                        <div className="p-3 bg-surface-2 border border-white/5 rounded-2xl rounded-tl-sm">
                                            <Loader2 className="w-4 h-4 text-white-40 animate-spin" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 border-t border-white/5 bg-surface-2 shrink-0 space-y-3">
                            {/* Quick Actions Array */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none hide-scrollbar">
                                {quickActions.map(action => (
                                    <button
                                        key={action.cmd}
                                        onClick={() => handleSend(action.cmd, action.cmd)}
                                        disabled={loading || !hasParsedResume}
                                        className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-3 hover:bg-white/10 border border-white/5 text-[11px] font-medium text-white-60 hover:text-white transition-all disabled:opacity-50"
                                    >
                                        {action.icon} {action.label}
                                    </button>
                                ))}
                            </div>

                            <div className="relative flex items-end">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a command (/fix) or ask a question..."
                                    className="w-full bg-surface border border-white/10 rounded-xl pl-3 pr-10 py-3 text-sm resize-none outline-none focus:border-indigo-500/50 transition-colors max-h-32 min-h-[44px] text-foreground placeholder:text-white-30 scrollbar-none"
                                    rows={1}
                                    disabled={loading || !hasParsedResume}
                                />
                                <button
                                    onClick={() => handleSend(input)}
                                    disabled={!input.trim() || loading || !hasParsedResume}
                                    className="absolute right-2 bottom-2 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:text-white-20 transition-colors disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
