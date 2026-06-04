import { useState, useRef, useEffect, useMemo, Component } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot, X, Send, Loader2, Target, CheckCircle2,
    Wand2, Plus, Sparkles, Briefcase, GraduationCap,
    TrendingUp, ExternalLink, Copy, ChevronRight,
    Zap, BookOpen, MessageCircle, HelpCircle,
    Trash2, MessageSquarePlus
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { toast } from "sonner";
import { DiffCard } from "./DiffCard";
import type { ResumePatch, AriaEdit } from "@/lib/resumeTypes";

// ── ErrorBoundary: prevents a single bad DiffCard from crashing the page ─────
class DiffCardErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(err: Error) { console.warn("[DiffCard] Render error caught:", err.message); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
                    ⚠️ Could not render the diff preview. The changes are still available — click Accept or Undo to proceed.
                </div>
            );
        }
        return this.props.children;
    }
}

// ── Types ──────────────────────────────────────────────
interface AgentStepUI {
    tool: string;
    thought: string;
    reflection?: string;
}

interface ChatMessage {
    id: string;
    role: "user" | "bot";
    content: string;
    command?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    timestamp?: number;
    toolsUsed?: string[];
    steps?: AgentStepUI[];
    intent?: string;
    aria_edit?: AriaEdit | null;
    resume_patch?: ResumePatch | null;
    patchAccepted?: boolean;
}

interface ChatbotResponse {
    message: string;
    command: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

interface ResumeChatbotProps {
    hasParsedResume: boolean;
    jobDescription: string;
    resumeData?: any | null;
    onAriaEdit?: (edit: AriaEdit) => void;   // auto-applied immediately
    onResumePatch?: (patch: ResumePatch) => void;
    onAcceptPatch?: (patch: ResumePatch) => void;
    onUndoPatch?: () => void;
}

// ── Quick Action Categories ──────────────────────────────
type ActionTab = "resume" | "jobs" | "interview" | "career";

const ACTION_TABS: { key: ActionTab; label: string; icon: React.ReactNode }[] = [
    { key: "resume", label: "Resume", icon: <Target className="w-3 h-3" /> },
    { key: "jobs", label: "Jobs", icon: <Briefcase className="w-3 h-3" /> },
    { key: "interview", label: "Interview", icon: <GraduationCap className="w-3 h-3" /> },
    { key: "career", label: "Career", icon: <TrendingUp className="w-3 h-3" /> },
];

const QUICK_ACTIONS: Record<ActionTab, { cmd: string; label: string; icon: React.ReactNode; needsResume: boolean }[]> = {
    resume: [
        { cmd: "/score", label: "ATS Score", icon: <Target className="w-3 h-3" />, needsResume: true },
        { cmd: "/fix", label: "Fix Bullets", icon: <Wand2 className="w-3 h-3" />, needsResume: true },
        { cmd: "/create", label: "Create Bullets", icon: <Plus className="w-3 h-3" />, needsResume: false },
        { cmd: "/improve", label: "Top Fixes", icon: <Zap className="w-3 h-3" />, needsResume: true },
        { cmd: "/latex", label: "LaTeX PDF", icon: <Bot className="w-3 h-3" />, needsResume: true },
        { cmd: "/draft", label: "Full Draft", icon: <BookOpen className="w-3 h-3" />, needsResume: true },
    ],
    jobs: [
        { cmd: "/jobs", label: "Find Jobs", icon: <Briefcase className="w-3 h-3" />, needsResume: false },
        { cmd: "/match", label: "JD Match", icon: <Target className="w-3 h-3" />, needsResume: true },
        { cmd: "/salary", label: "Salary Data", icon: <TrendingUp className="w-3 h-3" />, needsResume: false },
        { cmd: "/apply", label: "Apply Pack", icon: <ExternalLink className="w-3 h-3" />, needsResume: true },
    ],
    interview: [
        { cmd: "/prep", label: "Full Prep", icon: <GraduationCap className="w-3 h-3" />, needsResume: true },
        { cmd: "/predict-questions", label: "Questions", icon: <Sparkles className="w-3 h-3" />, needsResume: true },
        { cmd: "/behavioral", label: "Behavioral", icon: <MessageCircle className="w-3 h-3" />, needsResume: true },
        { cmd: "/mock", label: "Mock Interview", icon: <Zap className="w-3 h-3" />, needsResume: true },
    ],
    career: [
        { cmd: "/skills", label: "Skill Gap", icon: <Target className="w-3 h-3" />, needsResume: true },
        { cmd: "/roadmap", label: "90-Day Plan", icon: <TrendingUp className="w-3 h-3" />, needsResume: true },
        { cmd: "/linkedin", label: "LinkedIn", icon: <ExternalLink className="w-3 h-3" />, needsResume: true },
        { cmd: "/market", label: "Market Data", icon: <Briefcase className="w-3 h-3" />, needsResume: false },
        { cmd: "/help", label: "All Commands", icon: <HelpCircle className="w-3 h-3" />, needsResume: false },
    ],
};

// ── Professional Command Labels (shown instead of raw /create) ──
const COMMAND_LABELS: Record<string, string> = {
    "/score": "📊 Analyzing ATS compatibility...",
    "/fix": "✨ Optimizing resume bullets...",
    "/create": "✍️ Creating new resume bullets...",
    "/improve": "⚡ Finding top improvements...",
    "/latex": "📝 Generating LaTeX PDF...",
    "/draft": "📄 Drafting full resume...",
    "/jobs": "🔍 Searching matching jobs...",
    "/match": "🎯 Matching against job description...",
    "/salary": "💰 Fetching salary insights...",
    "/apply": "📬 Building application pack...",
    "/prep": "🎯 Preparing interview questions...",
    "/predict-questions": "🔮 Predicting interview questions...",
    "/behavioral": "💬 Generating behavioral questions...",
    "/mock": "🎤 Starting mock interview...",
    "/skills": "📋 Analyzing skill gaps...",
    "/roadmap": "🗺️ Building career roadmap...",
    "/linkedin": "🔗 Optimizing LinkedIn profile...",
    "/market": "📈 Analyzing job market...",
    "/help": "📖 Loading commands...",
    "/cover": "✉️ Writing cover letter...",
};

// ── Suggestion Chips per command ──────────────────────────
const SUGGESTIONS: Record<string, { label: string; cmd: string }[]> = {
    score: [
        { label: "Fix Issues", cmd: "/fix" },
        { label: "Full Draft", cmd: "/draft" },
        { label: "Top 5 Fixes", cmd: "/improve" },
    ],
    fix: [
        { label: "Re-Score", cmd: "/score" },
        { label: "Create More", cmd: "/create" },
    ],
    jobs: [
        { label: "Match JD", cmd: "/match" },
        { label: "Cover Letter", cmd: "/cover" },
    ],
    help: [
        { label: "Score ATS", cmd: "/score" },
        { label: "Find Jobs", cmd: "/jobs" },
        { label: "Interview Prep", cmd: "/prep" },
    ],
    chat: [
        { label: "Score My Resume", cmd: "/score" },
        { label: "Find Jobs", cmd: "/jobs" },
        { label: "Help", cmd: "/help" },
    ],
};

// ── Score Color Helper ───────────────────────────────────
function scoreColor(score: number): string {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#ef4444";
    return "#dc2626";
}

function scoreGrade(score: number): string {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B+";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    return "D";
}

// ── ATS Score Ring SVG Component ──────────────────────────
function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = scoreColor(score);

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={5} />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5}
                    strokeLinecap="round" strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-lg font-bold" style={{ color }}>{score}</span>
                <span className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">{scoreGrade(score)}</span>
            </div>
        </div>
    );
}

// ── Typing/Thinking Indicator ────────────────────────────
function TypingDots({ thinkingText }: { thinkingText?: string }) {
    return (
        <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                    <motion.span
                        key={i}
                        className="w-2 h-2 rounded-full bg-blue-500"
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
                        transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.15 }}
                    />
                ))}
            </div>
            {thinkingText && (
                <span className="text-[11px] text-blue-500 font-medium animate-pulse">
                    {thinkingText}
                </span>
            )}
        </div>
    );
}

// ── Tool Badge (for tools used) ──────────────────────────
const TOOL_LABELS: Record<string, string> = {
    get_resume_score: "📊 Resume Score",
    fix_resume_bullet: "✏️ Bullet Fix",
    get_resume_keywords: "🔑 Keywords",
    get_skill_gap: "📋 Skill Gap",
    rewrite_resume_section: "✍️ Rewrite",
    search_jobs: "🔍 Job Search",
    get_top_matched_jobs: "⭐ Top Matches",
    explain_job_match: "🎯 Match Explain",
    generate_cover_letter: "✉️ Cover Letter",
    generate_interview_questions: "❓ Questions",
    evaluate_interview_answer: "📝 Evaluate",
    mock_interview: "🎤 Mock Interview",
    generate_roadmap: "🗺️ Roadmap",
    optimize_linkedin: "🔗 LinkedIn",
    get_salary_insights: "💰 Salary",
    recall_user_preference: "🧠 Memory",
    save_user_preference: "💾 Save",
    edit_resume: "✏️ Resume Edit",
};

function ToolsBadge({ tools }: { tools: string[] }) {
    const [expanded, setExpanded] = useState(false);
    if (!tools || tools.length === 0) return null;
    return (
        <div className="mt-1.5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
            >
                <Zap className="w-3 h-3" />
                {tools.length} tool{tools.length > 1 ? 's' : ''} used
                <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            {expanded && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {tools.map((t, i) => (
                        <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] bg-blue-50 text-blue-600 border border-blue-100">
                            {TOOL_LABELS[t] || t}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Markdown Renderer Component ──────────────────────────
function MarkdownContent({ content }: { content: string }) {
    return (
        <div className="prose prose-slate prose-sm max-w-none
            prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:mb-1.5 prose-headings:mt-2
            prose-h1:text-sm prose-h2:text-[13px] prose-h3:text-xs
            prose-p:text-[12.5px] prose-p:leading-relaxed prose-p:text-gray-700 prose-p:mb-1.5
            prose-li:text-[12px] prose-li:text-gray-700 prose-li:leading-relaxed prose-li:my-0.5
            prose-ul:my-1 prose-ol:my-1 prose-ul:pl-3.5 prose-ol:pl-3.5
            prose-strong:text-gray-900 prose-strong:font-semibold
            prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:font-mono
            prose-pre:bg-white/60 prose-pre:backdrop-blur-sm prose-pre:border prose-pre:border-gray-200/50 prose-pre:rounded-lg prose-pre:p-2.5 prose-pre:text-[10.5px] prose-pre:text-gray-800
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline focus-visible:prose-a:outline-none focus-visible:prose-a:ring-2 focus-visible:prose-a:ring-blue-500 focus-visible:prose-a:rounded
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
        ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
}

// ════════════════════════════════════════════════════════════
// ██ MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export function ResumeChatbot({ hasParsedResume, jobDescription, resumeData, onAriaEdit, onResumePatch, onAcceptPatch, onUndoPatch }: ResumeChatbotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: "welcome",
        role: "bot",
        content: "👋 Hey! I'm **Aria**, your AI Career Coach.\n\nI can score your resume, find matching jobs, prep for interviews, and answer any questions about JobSkill AI.\n\nTry a quick action below or just ask me anything!",
        timestamp: Date.now(),
    }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<ActionTab>("resume");

    // Auto-scroll chat to bottom
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen, loading]);

    // Focus input on tab change
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen, activeTab]);

    // ── Message Count Badge ──────────────────────────────
    const unreadCount = useMemo(() => {
        if (isOpen) return 0;
        return messages.filter(m => m.role === "bot" && !m.id.startsWith("welcome")).length;
    }, [messages, isOpen]);

    // ── Welcome message factory ──────────────────────────
    const makeWelcome = (): ChatMessage => ({
        id: "welcome-" + Date.now(),
        role: "bot",
        content: "👋 Hey! I'm **Aria**, your AI Career Coach.\n\nI can score your resume, find matching jobs, prep for interviews, and answer any questions about JobSkill AI.\n\nTry a quick action below or just ask me anything!",
        timestamp: Date.now(),
    });

    // ── Clear / New Chat ─────────────────────────────────
    const clearChat = () => {
        setMessages([makeWelcome()]);
        setInput("");
    };

    // ── Thinking state ───────────────────────────────────
    const [thinkingText, setThinkingText] = useState<string | undefined>(undefined);

    // ── Handlers ─────────────────────────────────────────
    const handleSend = async (text: string = input, autoCmd?: string) => {
        if (!text.trim() && !autoCmd) return;

        const messageText = autoCmd ? autoCmd : text.trim();
        const userMsgId = Date.now().toString();

        // Show professional label instead of raw slash command
        const displayText = autoCmd && COMMAND_LABELS[autoCmd]
            ? COMMAND_LABELS[autoCmd]
            : messageText;

        setMessages(prev => [...prev, { id: userMsgId, role: "user", content: displayText, timestamp: Date.now() }]);
        setInput("");
        setLoading(true);
        setThinkingText("Analyzing your request...");

        try {
            const explicitCommand = autoCmd ? autoCmd.replace("/", "") : undefined;
            const token = localStorage.getItem("auth_token");
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

            // Try SSE streaming first
            const sseResponse = await fetch(`${API_URL}/api/chatbot/resume-chatbot`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message: messageText,
                    command: explicitCommand,
                    useAgent: true,
                    payload: { jobDescription: jobDescription || undefined },
                    // Send current resume data so the backend uses the correct UUIDs for patches
                    currentResumeData: resumeData || undefined,
                }),
            });

            const contentType = sseResponse.headers.get("content-type") || "";

            if (contentType.includes("text/event-stream") && sseResponse.body) {
                // ── SSE Path: Stream agent events ─────────────────
                const reader = sseResponse.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let finalMessage = "";
                let toolsUsed: string[] = [];
                let steps: AgentStepUI[] = [];
                let intent = "";
                let sseAriaEdit: AriaEdit | null = null;
                let sseResumePatch: ResumePatch | null = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        try {
                            const event = JSON.parse(line.slice(6));
                            if (event.type === "thinking") {
                                setThinkingText(event.message || "Thinking...");
                            } else if (event.type === "steps") {
                                steps = event.steps || [];
                                const toolNames = steps.map((s: AgentStepUI) => s.tool).filter(Boolean);
                                if (toolNames.length > 0) {
                                    setThinkingText(`Using ${TOOL_LABELS[toolNames[toolNames.length - 1]] || toolNames[toolNames.length - 1]}...`);
                                }
                            } else if (event.type === "message") {
                                finalMessage = event.content || "";
                                toolsUsed = event.toolsUsed || [];
                                intent = event.intent || "";
                                // Prefer AriaEdit (simple, auto-applied) over legacy ResumePatch
                                if (event.aria_edit?.action === "ARIA_EDIT") {
                                    sseAriaEdit = event.aria_edit;
                                } else if (event.resume_patch?.action === "PATCH_RESUME") {
                                    sseResumePatch = event.resume_patch;
                                }
                            } else if (event.type === "done") {
                                break;
                            }
                        } catch { /* skip parse errors */ }
                    }
                }

                // Auto-apply AriaEdit (new, simple), or notify parent of legacy patch
                if (sseAriaEdit && onAriaEdit) {
                    onAriaEdit(sseAriaEdit);
                } else if (sseResumePatch && onResumePatch) {
                    onResumePatch(sseResumePatch);
                }

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "bot",
                    content: finalMessage || "I processed your request.",
                    command: intent,
                    toolsUsed,
                    steps,
                    intent,
                    data: { reply: finalMessage, toolsUsed, intent },
                    timestamp: Date.now(),
                    aria_edit: sseAriaEdit,
                    resume_patch: sseResumePatch,
                }]);
            } else {
                // ── JSON fallback path ────────────────────────────
                const res = await sseResponse.json();
                const botMessage = res.message || res.data?.message || "Here is what I found:";
                const botCommand = res.command || res.data?.command;
                const botData = res.data;
                const jsonAriaEdit: AriaEdit | null =
                    (res.aria_edit?.action === "ARIA_EDIT" ? res.aria_edit : null) ||
                    (botData?.aria_edit?.action === "ARIA_EDIT" ? botData.aria_edit : null);
                const jsonResumePatch: ResumePatch | null =
                    !jsonAriaEdit && (res.resume_patch?.action === "PATCH_RESUME" ? res.resume_patch : null) ||
                    !jsonAriaEdit && (botData?.resume_patch?.action === "PATCH_RESUME" ? botData.resume_patch : null) || null;

                if (jsonAriaEdit && onAriaEdit) {
                    onAriaEdit(jsonAriaEdit);
                } else if (jsonResumePatch && onResumePatch) {
                    onResumePatch(jsonResumePatch);
                }

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "bot",
                    content: botMessage,
                    command: botCommand,
                    data: botData,
                    toolsUsed: botData?.toolsUsed || [],
                    steps: botData?.steps || [],
                    intent: botData?.intent || botCommand,
                    timestamp: Date.now(),
                    aria_edit: jsonAriaEdit,
                    resume_patch: jsonResumePatch,
                }]);
            }

        } catch (err: unknown) {
            console.error("Chatbot API Error:", err);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errorObj = err as any;
            const errorMsg = errorObj?.response?.data?.message || errorObj?.message || "Something went wrong. Please try again.";

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: `⚠️ ${errorMsg}`,
                timestamp: Date.now(),
            }]);
            toast.error("Chatbot failed to respond.");
        } finally {
            setLoading(false);
            setThinkingText(undefined);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    // ── Last bot command for suggestions ──────────────────
    const lastBotMsg = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "bot" && messages[i].command) return messages[i];
        }
        return null;
    }, [messages]);

    const suggestions = lastBotMsg?.command ? SUGGESTIONS[lastBotMsg.command] || [] : [];

    // ════════════════════════════════════════════════════════
    // ── RICH DATA RENDERERS ──
    // ════════════════════════════════════════════════════════
    const renderComplexData = (msg: ChatMessage) => {
        if (!msg.data) return null;

        // ── 1. ATS SCORE with Score Ring + Platform Breakdown ──
        if (msg.command === "score" && msg.data.greenhouse && msg.data.lever) {
            const gh = msg.data.greenhouse;
            const lv = msg.data.lever;
            const ashby = msg.data.ashby;
            const naukri = msg.data.naukri;
            const avg = Math.round(
                ((gh?.overallScore || 0) + (lv?.overallScore || 0) +
                 (ashby?.overallScore || 0) + (naukri?.overallScore || 0)) / 4
            );

            return (
                <div className="mt-3 space-y-3">
                    {/* Circular Score */}
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-white/70 border border-gray-200 shadow-sm">
                        <ScoreRing score={avg} />
                        <div className="flex-1 space-y-1.5">
                            <p className="text-xs font-semibold text-gray-900">Average ATS Score</p>
                            <p className="text-[10px] text-gray-600">Across 4 ATS platforms</p>
                        </div>
                    </div>

                    {/* Platform Bars */}
                    <div className="space-y-2">
                        {[
                            { name: "Greenhouse", score: gh?.overallScore || 0, color: "#22c55e" },
                            { name: "Lever", score: lv?.overallScore || 0, color: "#3b82f6" },
                            { name: "Ashby", score: ashby?.overallScore || 0, color: "#a855f7" },
                            { name: "Naukri", score: naukri?.overallScore || 0, color: "#f59e0b" },
                        ].map(p => (
                            <div key={p.name} className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-600">{p.name}</span>
                                    <span className="font-semibold" style={{ color: p.color }}>{p.score}/100</span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: p.color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${p.score}%` }}
                                        transition={{ duration: 0.8, delay: 0.2 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Keyword Warning */}
                    {gh?.fields?.keywords?.status === "warning" && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-700">
                            <Target className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Missing ATS keywords detected. Use <code className="bg-rose-100 px-1 rounded text-rose-800">/fix</code> to optimize.</span>
                        </div>
                    )}
                </div>
            );
        }

        // ── 2. FIXED BULLETS ──
        if (msg.command === "fix" && msg.data.improvedBullets?.length > 0) {
            return (
                <div className="mt-3 space-y-2.5">
                    {msg.data.improvedBullets.map((b: { original: string; improved: string; addedKeywords?: string[] }, i: number) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-gray-200">
                            <div className="px-3 py-2 bg-rose-50 border-b border-gray-200">
                                <p className="text-[10.5px] text-rose-700 line-through leading-relaxed opacity-80">"{b.original}"</p>
                            </div>
                            <div className="px-3 py-2 bg-emerald-50">
                                <div className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                    <p className="text-[10.5px] text-emerald-800 leading-relaxed">{b.improved}</p>
                                </div>
                                {b.addedKeywords && b.addedKeywords.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1 pl-4.5">
                                        {b.addedKeywords.map((kw: string) => (
                                            <span key={kw} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-medium">{kw}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // ── 3. CREATED BULLETS ──
        if (msg.command === "create" && msg.data.generatedBullets?.length > 0) {
            return (
                <div className="mt-3 space-y-2">
                    {msg.data.generatedBullets.map((b: { bullet: string; focus: string }, i: number) => (
                        <button key={i}
                            className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-white/50 hover:bg-white hover:border-blue-300 transition-colors group cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={() => copyToClipboard(b.bullet)}
                        >
                            <p className="text-[11px] text-gray-800 leading-relaxed">{b.bullet}</p>
                            <div className="mt-1.5 flex justify-between items-center">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">{b.focus}</span>
                                <Copy className="w-3 h-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            );
        }

        // ── 4. INTERVIEW QUESTIONS ──
        if ((msg.command === "predict-questions" || msg.command === "questions") && msg.data.categories?.length > 0) {
            return (
                <div className="mt-3 space-y-3">
                    {msg.data.categories.map((cat: { title: string; questions: { question: string; skill?: string; suggestedAnswer?: string }[] }, ci: number) => (
                        <div key={ci} className="rounded-lg border border-gray-200 overflow-hidden bg-white/50 shadow-sm">
                            <div className="px-3 py-1.5 bg-blue-50 border-b border-gray-200">
                                <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">{cat.title}</p>
                            </div>
                            <div className="p-2 space-y-1.5">
                                {cat.questions.map((q: { question: string; skill?: string; suggestedAnswer?: string }, qi: number) => (
                                    <div key={qi} className="flex items-start gap-2 text-[10.5px] text-gray-700 leading-relaxed">
                                        <ChevronRight className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p>{q.question}</p>
                                            {q.skill && <span className="text-[9px] text-gray-500 font-medium">{q.skill}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // ── 5. LATEX CODE ──
        if (msg.command === "latex" && msg.data?.latex) {
            return (
                <div className="mt-3">
                    <div className="relative group">
                        <textarea
                            readOnly
                            className="w-full h-28 bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-[10px] font-mono text-gray-800 resize-none outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                            value={msg.data.latex}
                        />
                        <button
                            onClick={() => copyToClipboard(msg.data.latex)}
                            className="absolute top-2 right-2 px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Copy
                        </button>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-1.5">Paste into Overleaf or compile with pdflatex.</p>
                </div>
            );
        }

        // ── 6. JOB RESULTS (from /jobs command) ──
        if (msg.command === "jobs" && msg.data?.jobs?.length > 0) {
            return (
                <div className="mt-3 space-y-2">
                    {msg.data.jobs.slice(0, 5).map((j: { title: string; company: string; location: string; match_score?: number; job_url?: string }, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg border border-gray-200 bg-white/60 hover:bg-white hover:border-blue-300 transition-colors shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-gray-900 truncate">{j.title}</p>
                                    <p className="text-[10px] text-gray-600">{j.company} · {j.location}</p>
                                </div>
                                {j.match_score && (
                                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        j.match_score >= 80 ? 'bg-green-100 text-green-800' :
                                        j.match_score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {j.match_score}%
                                    </span>
                                )}
                            </div>
                            {j.job_url && (
                                <a href={j.job_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-1.5 text-[9px] text-blue-600 hover:text-blue-800 font-medium transition-colors focus:outline-none focus:underline">
                                    Apply <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        // ── 7. GENERIC REPLY TEXT (for /help, /keywords, /compare, /salary, etc.) ──
        if (msg.data?.reply && typeof msg.data.reply === "string") {
            return (
                <div className="mt-2">
                    <MarkdownContent content={msg.data.reply} />
                </div>
            );
        }

        return null;
    };

    // ════════════════════════════════════════════════════════
    // ██ RENDER
    // ════════════════════════════════════════════════════════
    return (
        <>
            {/* ── Floating Action Button ── */}
            <motion.button
                id="chatbot-fab"
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`fixed bottom-6 right-6 z-40 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300 rounded-full ${isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100'}`}
            >
                <div className="relative">
                    {/* Gradient pulse ring */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 animate-pulse-ring opacity-40" />
                    {/* Main button */}
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 shadow-lg shadow-blue-500/25 flex items-center justify-center ring-2 ring-blue-500/20">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    {/* Badge */}
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-[#0c0c14]">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                    {/* Status dot */}
                    {!hasParsedResume && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 ring-2 ring-[#0c0c14]" />
                        </span>
                    )}
                </div>
            </motion.button>

            {/* ── Chatbot Window ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        style={{ transformOrigin: "bottom right" }}
                        className="fixed bottom-6 right-6 w-[400px] h-[600px] max-h-[85vh] flex flex-col rounded-2xl shadow-xl shadow-black/10 z-50 overflow-hidden bg-gradient-to-b from-pink-100/95 via-yellow-50/95 to-blue-100/95 backdrop-blur-md border border-border"
                    >
                        {/* ═══ HEADER ═══ */}
                        <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border bg-white/40 shadow-sm">
                            <div className="flex items-center gap-3">
                                {/* Animated avatar */}
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
                                        <Bot className="w-4.5 h-4.5 text-white" />
                                    </div>
                                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${loading ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-semibold text-gray-900 tracking-tight">Aria — AI Career Coach</h3>
                                    <p className="text-[10px] text-gray-600 flex items-center gap-1">
                                        {loading ? (
                                            <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Thinking...</>
                                        ) : hasParsedResume ? (
                                            <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Resume connected</>
                                        ) : (
                                            <><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Upload resume to unlock all features</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* New Chat */}
                                <button
                                    onClick={clearChat}
                                    title="New Chat"
                                    className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500 hover:text-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <MessageSquarePlus className="w-3.5 h-3.5" />
                                </button>
                                {/* Clear History */}
                                <button
                                    onClick={() => { clearChat(); toast.success("Chat cleared"); }}
                                    title="Clear Chat"
                                    className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500 hover:text-rose-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                {/* Close */}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    title="Close"
                                    className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500 hover:text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* ═══ MESSAGES AREA ═══ */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                            style={{ scrollbarWidth: "none" }}
                        >
                            <style>{`.chatbot-messages::-webkit-scrollbar { display: none; }`}</style>
                            <AnimatePresence initial={false}>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                                    >
                                        <div className={`max-w-[88%] ${msg.role === "user"
                                            ? "rounded-2xl rounded-br-md px-3.5 py-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20"
                                            : "rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-sm"
                                        }`}>
                                            {msg.role === "user" ? (
                                                <p className="text-[12.5px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                            ) : (
                                                <>
                                                    <MarkdownContent content={msg.content} />
                                                    {/* AriaEdit — auto-applied indicator */}
                                                    {msg.aria_edit && (
                                                        <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-medium">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                            <span>Changes applied to your resume — switch to <strong>Live Edit</strong> tab to see them</span>
                                                        </div>
                                                    )}

                                                    {/* Resume Patch DiffCard (legacy) */}
                                                    {msg.resume_patch && (
                                                        <DiffCardErrorBoundary>
                                                        <DiffCard
                                                            patch={msg.resume_patch}
                                                            isAccepted={!!msg.patchAccepted}
                                                            onAccept={(patch) => {
                                                                setMessages(prev => prev.map(m =>
                                                                    m.id === msg.id ? { ...m, patchAccepted: true } : m
                                                                ));
                                                                onAcceptPatch?.(patch);
                                                            }}
                                                            onUndo={() => {
                                                                setMessages(prev => prev.map(m =>
                                                                    m.id === msg.id ? { ...m, patchAccepted: false } : m
                                                                ));
                                                                onUndoPatch?.();
                                                            }}
                                                        />
                                                        </DiffCardErrorBoundary>
                                                    )}
                                                    {renderComplexData(msg)}
                                                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                                                        <ToolsBadge tools={msg.toolsUsed} />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {msg.command && msg.role === "bot" && (
                                            <span className="text-[8px] text-gray-400 mt-0.5 ml-1 uppercase tracking-widest font-medium">
                                                /{msg.command}
                                            </span>
                                        )}
                                    </motion.div>
                                ))}

                                {/* Typing indicator */}
                                {loading && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start"
                                    >
                                        <div className="rounded-2xl rounded-bl-md bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-sm">
                                            <TypingDots thinkingText={thinkingText} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Suggestion Chips */}
                            {!loading && suggestions.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-wrap gap-1.5 pt-1"
                                >
                                    {suggestions.map(s => (
                                        <button
                                            key={s.cmd}
                                            onClick={() => handleSend(s.cmd, s.cmd)}
                                            disabled={!hasParsedResume && s.cmd !== "/help" && s.cmd !== "/jobs"}
                                            className="text-[10px] px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* ═══ INPUT AREA ═══ */}
                        <div className="shrink-0 px-3 pb-3 pt-2 space-y-2 border-t border-border">
                            {/* Quick Action Tabs */}
                            <div className="flex gap-1">
                                {ACTION_TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            activeTab === tab.key
                                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-black/5 border border-transparent'
                                        }`}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                                {QUICK_ACTIONS[activeTab].map(action => (
                                    <button
                                        key={action.cmd}
                                        onClick={() => handleSend(action.cmd, action.cmd)}
                                        disabled={loading || (action.needsResume && !hasParsedResume)}
                                        className="whitespace-nowrap shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all
                                            bg-white/60 border border-gray-200/60 text-gray-600
                                            hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm
                                            disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                            </div>

                            {/* Text Input */}
                            <div className="relative flex items-end">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={hasParsedResume ? "Ask anything or type /score..." : "Ask me about JobSkill features..."}
                                    className="w-full rounded-xl pl-3.5 pr-10 py-2.5 text-[12.5px] resize-none outline-none max-h-24 min-h-[40px] text-gray-800 placeholder:text-gray-400 bg-white/70 border border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 shadow-inner"
                                    style={{
                                        scrollbarWidth: "none",
                                    }}
                                    rows={1}
                                    disabled={loading}
                                />
                                <button
                                    onClick={() => handleSend(input)}
                                    disabled={!input.trim() || loading}
                                    className={`absolute right-1.5 bottom-1.5 p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${input.trim() ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md' : 'text-gray-400 opacity-50'}`}
                                >
                                    {loading
                                        ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                        : <Send className="w-4 h-4" />
                                    }
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
