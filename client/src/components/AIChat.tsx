import { useState, useRef, useEffect } from "react";
import { useChat, type AIFeature, type Conversation } from "../hooks/useChat";
import {
    Send, Paperclip, Image as ImageIcon, X, FileText, Plus,
    MessageSquare, Trash2, MoreHorizontal, Loader2, Code, FileEdit,
    Target, HelpCircle, Sparkles, ChevronLeft, ChevronRight, PenLine,
    CheckCircle2, AlertTriangle, TrendingUp, Shield, Zap, Award,
    BarChart3, Search,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
).toString();

const QUICK_PROMPTS = [
    { label: "Score Resume", icon: "📊", feature: "chat" as AIFeature, text: "/score" },
    { label: "Rewrite Summary", icon: "✨", feature: "chat" as AIFeature, text: "/rewrite summary" },
    { label: "Fix Bullets", icon: "🔧", feature: "chat" as AIFeature, text: "/fix" },
    { label: "Full Draft", icon: "📝", feature: "chat" as AIFeature, text: "/draft" },
    { label: "Find Jobs", icon: "💼", feature: "chat" as AIFeature, text: "/jobs" },
    { label: "Cover Letter", icon: "✍️", feature: "cover_letter" as AIFeature, text: "/cover" },
    { label: "Interview Prep", icon: "🎤", feature: "chat" as AIFeature, text: "/prep" },
    { label: "All Commands", icon: "📋", feature: "chat" as AIFeature, text: "/help" },
];

function ModelBadge({ provider, model }: { provider?: string; model?: string }) {
    return null;
}

function formatMarkdown(text: string) {
    return text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-50 border border-gray-200 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-blue-700 shadow-inner"><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code class="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 border border-blue-100 text-sm font-mono">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, "<strong class='text-gray-900'>$1</strong>")
        .replace(/^### (.+)$/gm, "<h3 class='text-gray-900 font-semibold text-base mt-3 mb-1'>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2 class='text-gray-900 font-semibold text-lg mt-4 mb-1'>$1</h2>")
        .replace(/^[•\-] (.+)$/gm, "<li class='ml-4'>$1</li>")
        .replace(/^\d+\.\s(.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
        .replace(/\n\n/g, "</p><p class='mt-2'>")
        .replace(/\n/g, "<br/>");
}

// ── Score color helpers ─────────────────────────────────────
function scoreColor(score: number): string {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-rose-400";
}
function scoreBg(score: number): string {
    if (score >= 80) return "bg-emerald-400";
    if (score >= 60) return "bg-amber-400";
    return "bg-rose-400";
}
function scoreGlow(score: number): string {
    if (score >= 80) return "shadow-emerald-500/30";
    if (score >= 60) return "shadow-amber-500/30";
    return "shadow-rose-500/30";
}
function riskBadge(risk: string) {
    const map: Record<string, { bg: string; text: string }> = {
        LOW: { bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400" },
        MEDIUM: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400" },
        HIGH: { bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-400" },
    };
    const style = map[risk] || map.MEDIUM;
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${style.bg} ${style.text}`}>
            {risk} Risk
        </span>
    );
}

// ── ATS Analysis Card ───────────────────────────────────────
function ATSAnalysisCard({ data }: { data: any }) {
    const [activeTab, setActiveTab] = useState<"overview" | "issues" | "simulators" | "keywords">("overview");

    if (!data) return null;

    const {
        score = 0,
        grade = "—",
        percentile = "",
        label = "",
        atsRisk = "MEDIUM",
        breakdown = {},
        issues = [],
        topIssues = [],
        completedChecks = [],
        nextSteps = [],
        keywords = {},
        inferredSkills = [],
        simulators = {},
    } = data;

    const warningIssues = issues.filter((i: any) => i.type === "warning");
    const successIssues = issues.filter((i: any) => i.type === "success");

    const tabs = [
        { key: "overview" as const, label: "Overview", icon: BarChart3 },
        { key: "issues" as const, label: `Issues (${warningIssues.length})`, icon: AlertTriangle },
        { key: "simulators" as const, label: "Simulators", icon: Shield },
        { key: "keywords" as const, label: "Keywords", icon: Search },
    ];

    return (
        <div className="mt-4 bg-white/70 backdrop-blur-md border border-gray-200/60 rounded-2xl overflow-hidden shadow-xl shadow-blue-500/5">
            {/* Header — Score Display */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-50/50 to-transparent border-b border-gray-200/60">
                <div className="flex items-center gap-4">
                    {/* Score Circle */}
                    <div className={`relative w-20 h-20 rounded-full border-4 ${score >= 80 ? 'border-emerald-400' : score >= 60 ? 'border-amber-400' : 'border-rose-400'} flex items-center justify-center shadow-lg ${scoreGlow(score)} flex-shrink-0`}>
                        <div className="text-center">
                            <span className={`text-2xl font-display font-bold ${scoreColor(score)}`}>{score}</span>
                            <span className="text-[9px] text-gray-500 block -mt-0.5">/100</span>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-lg font-display font-bold ${scoreColor(score)}`}>{label}</span>
                            <span className="px-2 py-0.5 rounded-md bg-white/70 text-gray-600 text-xs font-bold">{grade}</span>
                            {riskBadge(atsRisk)}
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{percentile}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200/60">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2
                            ${activeTab === tab.key
                                ? "text-blue-600 border-blue-600 bg-blue-50/50"
                                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-black/5"}`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="p-4 max-h-[400px] overflow-y-auto scrollbar-hide">
                {/* ── OVERVIEW TAB ── */}
                {activeTab === "overview" && (
                    <div className="space-y-4">
                        {/* Breakdown Bars */}
                        <div className="space-y-2.5">
                            <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Score Breakdown</h4>
                            {Object.entries(breakdown).map(([key, val]: [string, any]) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-600 capitalize">{key}</span>
                                        <span className={`font-mono font-bold ${scoreColor((val.score / val.max) * 100)}`}>
                                            {val.score}/{val.max}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${scoreBg((val.score / val.max) * 100)}`}
                                            style={{ width: `${Math.round((val.score / val.max) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Next Steps */}
                        {nextSteps.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                                    <TrendingUp className="w-3 h-3" /> Top Fixes
                                </h4>
                                {nextSteps.map((step: any, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-xs bg-gray-100 rounded-lg p-2.5 border border-border">
                                        <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-800 flex-1">{step.action}</span>
                                        <span className="text-emerald-400 font-mono font-bold text-[10px] flex-shrink-0">{step.score_gain}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Completed Checks */}
                        {completedChecks.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Passed Checks
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {completedChecks.map((check: any, i: number) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                            {check.category}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Inferred Skills */}
                        {inferredSkills.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">AI-Detected Skills</h4>
                                <div className="flex flex-wrap gap-1">
                                    {inferredSkills.slice(0, 15).map((skill: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px]">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ISSUES TAB ── */}
                {activeTab === "issues" && (
                    <div className="space-y-3">
                        {topIssues.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Priority Issues</h4>
                                {topIssues.map((issue: any, i: number) => (
                                    <div key={i} className={`p-3 rounded-xl border ${issue.is_locked ? 'border-border opacity-60' : 'border-amber-500/20 bg-amber-500/5'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-800">{issue.category}</span>
                                            <span className="text-emerald-400 font-mono font-bold text-[10px]">+{issue.point_gain} pts</span>
                                        </div>
                                        {issue.sub_issues?.map((sub: any, j: number) => (
                                            <p key={j} className="text-[11px] text-gray-600 leading-relaxed">{sub.text}</p>
                                        ))}
                                        {issue.is_locked && (
                                            <p className="text-[9px] text-gray-400 mt-1 italic">Fix higher-priority issues first</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Success items */}
                        {successIssues.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-3">Passed</h4>
                                {successIssues.map((issue: any, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-[11px]">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-600">{issue.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {warningIssues.length === 0 && successIssues.length === 0 && (
                            <p className="text-gray-500 text-xs text-center py-6">No issues detected.</p>
                        )}
                    </div>
                )}

                {/* ── SIMULATORS TAB ── */}
                {activeTab === "simulators" && (
                    <div className="space-y-3">
                        <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">ATS Platform Simulation</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(simulators).map(([name, sim]: [string, any]) => (
                                <div key={name} className="bg-gray-100 rounded-xl p-3 border border-border hover:border-border transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-800 capitalize">{name}</span>
                                        <span className={`text-lg font-display font-bold ${scoreColor(sim.overallScore)}`}>
                                            {sim.overallScore}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${scoreBg(sim.overallScore)}`}
                                            style={{ width: `${sim.overallScore}%` }}
                                        />
                                    </div>
                                    {/* Field statuses */}
                                    <div className="mt-2 space-y-0.5">
                                        {sim.fields && Object.entries(sim.fields).map(([fieldName, field]: [string, any]) => {
                                            if (fieldName === "keywords" || fieldName === "bulletAnalysis") return null;
                                            const statusIcon = field.status === "success" ? "✅"
                                                : field.status === "warning" ? "⚠️" : "❌";
                                            return (
                                                <div key={fieldName} className="flex items-center gap-1 text-[9px]">
                                                    <span>{statusIcon}</span>
                                                    <span className="text-gray-500 capitalize">{fieldName}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Keyword details from simulators */}
                        {Object.entries(simulators).map(([name, sim]: [string, any]) => {
                            const kw = sim.fields?.keywords;
                            if (!kw) return null;
                            return (
                                <div key={`kw-${name}`} className="bg-gray-100 rounded-xl p-3 border border-border">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-gray-500 uppercase font-semibold">{name} Keyword Match</span>
                                        <span className={`text-xs font-bold ${kw.status === "success" ? "text-emerald-400" : kw.status === "warning" ? "text-amber-400" : "text-rose-400"}`}>
                                            {kw.extracted}
                                        </span>
                                    </div>
                                    {kw.suggestion && <p className="text-[10px] text-slate-400 leading-relaxed">{kw.suggestion}</p>}
                                    {kw.missing?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {kw.missing.slice(0, 8).map((m: string) => (
                                                <span key={m} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[9px]">{m}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── KEYWORDS TAB ── */}
                {activeTab === "keywords" && (
                    <div className="space-y-3">
                        {/* Found Keywords */}
                        {keywords.found?.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    Found in Resume ({keywords.found.length})
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {keywords.found.map((kw: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px]">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Missing Keywords */}
                        {keywords.missing?.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                                    Missing Keywords ({keywords.missing.length})
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {keywords.missing.map((kw: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px]">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-border">
                            {keywords.matched ?? 0} of {keywords.total ?? 0} global tech skills detected
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageBubble({ message }: { message: any }) {
    const isUser = message.role === "user";
    const payload = message.dataPayload;
    
    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
            {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1 shadow-lg shadow-blue-500/20">
                    ✦
                </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${isUser
                ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-md shadow-md shadow-blue-500/20"
                : "bg-white text-gray-800 border border-gray-200/50 shadow-sm rounded-bl-md"}`}>
                
                {isUser ? (
                    <div>
                        {Array.isArray(message.content) ? message.content.map((part: any, idx: number) => (
                            <div key={idx}>
                                {part.type === "text" && <p>{part.text}</p>}
                                {part.type === "image" && <img src={`data:${part.mimeType};base64,${part.base64}`} alt="Upload" className="max-h-60 rounded-lg mt-2 border border-border" />}
                            </div>
                        )) : <p dangerouslySetInnerHTML={{ __html: formatMarkdown(String(message.content)) }} />}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(String(message.content)) }}
                            className="prose prose-sm prose-slate max-w-none [&_li]:text-gray-700" />
                            
                        {/* ATS Analysis Card */}
                        {payload && payload.type === "ats_analysis" && payload.data && (
                            <ATSAnalysisCard data={payload.data} />
                        )}

                        {/* Legacy: score dataPayload */}
                        {payload && payload.type === "score" && payload.data && (
                            <div className="bg-white border border-blue-200 rounded-xl p-4 mt-3 flex flex-col gap-3 shadow-md shadow-blue-500/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Live ATS Score</span>
                                    <span className={`text-xl font-display font-bold ${payload.data.ats_score > 75 ? 'text-green-600' : 'text-amber-500'}`}>
                                        {payload.data.ats_score}<span className="text-xs text-gray-400">/100</span>
                                    </span>
                                </div>
                                {payload.data.issues?.length > 0 && (
                                     <div className="space-y-1.5 mt-1 border-t border-gray-100 pt-3">
                                         <p className="text-[10px] text-gray-400 uppercase tracking-widest">Detected Issues</p>
                                         {payload.data.issues.slice(0, 3).map((issue: string, idx: number) => (
                                             <div key={idx} className="flex gap-2 text-xs">
                                                 <span className="text-amber-500 shrink-0">⚠️</span>
                                                 <span className="text-gray-700">{issue}</span>
                                             </div>
                                         ))}
                                     </div>
                                )}
                            </div>
                        )}
                        
                        {/* Legacy: latex dataPayload */}
                        {payload && payload.type === "latex" && payload.data && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-3">
                                <div className="flex items-center justify-between mb-2">
                                     <span className="text-gray-600 text-xs font-semibold uppercase">LaTeX Source</span>
                                     <button 
                                        onClick={() => navigator.clipboard.writeText(payload.data)}
                                        className="text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-2 py-1 rounded text-[10px] transition-colors shadow-sm"
                                     >
                                         Copy Code
                                     </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto rounded bg-white border border-gray-200 p-3">
                                    <pre className="text-[10px] text-blue-700 font-mono">
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

function TypingIndicator({ isAnalyzing }: { isAnalyzing?: boolean }) {
    return (
        <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-blue-500/20">✦</div>
            <div className="bg-white border border-gray-200/60 rounded-2xl rounded-bl-md px-5 py-3.5 shadow-sm">
                <div className="flex gap-1.5 items-center h-5">
                    {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    <span className="text-gray-500 text-xs ml-2">
                        {isAnalyzing ? "📄 Analyzing your resume..." : "Aria is thinking..."}
                    </span>
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
            ${isActive ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm" : "text-gray-600 hover:bg-white/60 hover:text-gray-900 border border-transparent hover:shadow-sm"}`}
            onClick={() => !editing && onSelect()}>
            <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
            {editing ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onBlur={handleRename} onKeyDown={e => e.key === "Enter" && handleRename()}
                    className="flex-1 bg-transparent text-gray-900 text-sm outline-none border-b border-blue-400"
                    autoFocus onClick={e => e.stopPropagation()} />
            ) : <span className="flex-1 truncate text-[13px] font-medium">{conv.title}</span>}
            <div className="relative">
                <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200/50 transition-all">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                    <div className="absolute right-0 top-7 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 min-w-[120px]"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditing(true); setShowMenu(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2">
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
        analyzeResume,
        conversations, activeConversationId, loadConversation,
        deleteConversation, renameConversation, loadingHistory,
    } = useChat();

    const [input, setInput] = useState("");
    const [attachments, setAttachments] = useState<any[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeFeature, setActiveFeature] = useState<AIFeature>("chat");
    const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
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

    // ── Check if attachments contain a resume (PDF/DOCX) ────────
    function findResumeAttachment(atts: any[]): any | null {
        return atts.find(att => {
            if (att.type !== "document") return false;
            const name = (att.name || "").toLowerCase();
            return name.endsWith(".pdf") || name.endsWith(".docx");
        }) || null;
    }

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;

        // ── Auto-detect resume upload → run ATS analysis ──
        const resumeAtt = findResumeAttachment(attachments);
        if (resumeAtt && resumeAtt.text && resumeAtt.text.trim().length > 30) {
            setIsAnalyzingResume(true);
            const jd = input.trim().length > 10 ? input.trim() : undefined;
            await analyzeResume(resumeAtt.text, resumeAtt.name, jd);
            setInput("");
            setAttachments([]);
            setIsAnalyzingResume(false);
            inputRef.current?.focus();
            return;
        }

        // ── Normal send flow ──
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
        <div className="flex h-[calc(100vh-4rem)] bg-gradient-to-br from-pink-50/50 via-yellow-50/50 to-blue-50/50">
            {/* Sidebar */}
            <div className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden border-r border-gray-200/60 bg-white/40 backdrop-blur-md flex flex-col shrink-0`}>
                <div className="p-3 border-b border-gray-200/60">
                    <button onClick={clearChat}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all text-sm font-semibold border border-blue-200">
                        <Plus className="w-4 h-4" /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                    {conversations.length === 0 ? (
                        <p className="text-gray-400 text-xs text-center py-8">No conversations yet</p>
                    ) : conversations.map(conv => (
                        <ConversationItem key={conv.id} conv={conv}
                            isActive={conv.id === activeConversationId}
                            onSelect={() => loadConversation(conv.id)}
                            onDelete={() => deleteConversation(conv.id)}
                            onRename={(t) => renameConversation(conv.id, t)} />
                    ))}
                </div>
                <div className="p-3 border-t border-gray-200/60">
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-4xl mx-auto w-full">
                    {loadingHistory ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-gray-500 text-sm">Loading conversation...</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
                            {isLoading && <TypingIndicator isAnalyzing={isAnalyzingResume} />}
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
                                    className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl border border-gray-200/60 text-gray-600 bg-white/60 backdrop-blur-sm hover:bg-white hover:text-gray-900 hover:border-blue-300 transition-all disabled:opacity-50 text-left shadow-sm">
                                    <span className="text-base">{p.icon}</span>
                                    <span className="font-medium">{p.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="bg-white/40 backdrop-blur-md border-t border-gray-200/60 px-4 py-3">
                    {attachments.length > 0 && (
                        <div className="max-w-4xl mx-auto flex flex-wrap gap-2 mb-3">
                            {attachments.map((att, i) => {
                                const isResume = att.type === "document" && /\.(pdf|docx)$/i.test(att.name || "");
                                return (
                                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border ${
                                        isResume
                                            ? "bg-purple-50 border-purple-200 text-purple-700"
                                            : "bg-blue-50 border-blue-200 text-blue-700"
                                    }`}>
                                        {att.type === "image" ? (
                                            <div className="w-8 h-8 rounded overflow-hidden"><img src={`data:${att.mimeType};base64,${att.base64}`} alt="" className="w-full h-full object-cover" /></div>
                                        ) : <FileText className="w-4 h-4" />}
                                        <span className="max-w-[100px] truncate">{att.name}</span>
                                        {isResume && <span className="text-[9px] opacity-60">ATS scan</span>}
                                        <button onClick={() => removeAttachment(i)} className="p-0.5 hover:bg-black/5 rounded-full"><X className="w-3 h-3" /></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="max-w-4xl mx-auto flex items-end gap-2 bg-white border border-gray-200 rounded-2xl px-2 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 shadow-inner transition-all">
                        <div className="flex flex-col gap-0.5">
                            <button type="button" onClick={() => document.getElementById("chat-doc-upload")?.click()}
                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Upload Resume (PDF/DOCX)">
                                <Paperclip className="w-5 h-5" />
                                <input type="file" id="chat-doc-upload" className="hidden" accept=".txt,.md,.pdf,.docx"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "doc"); e.target.value = ""; }} />
                            </button>
                            <button type="button" onClick={() => document.getElementById("chat-img-upload")?.click()}
                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Upload Image">
                                <ImageIcon className="w-5 h-5" />
                                <input type="file" id="chat-img-upload" className="hidden" accept="image/*"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, "img"); e.target.value = ""; }} />
                            </button>
                        </div>
                        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                            placeholder={activeFeature === "code_gen" ? "Describe the code you need..." : activeFeature === "cover_letter" ? "Paste job description for cover letter..." : "Ask me anything or upload a resume for ATS analysis..."}
                            rows={1} disabled={isLoading}
                            className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-800 focus:outline-none resize-none max-h-32 disabled:opacity-50 placeholder:text-gray-400"
                            style={{ minHeight: "40px" }}
                            onInput={(e: any) => { e.target.style.height = "40px"; e.target.style.height = e.target.scrollHeight + "px"; }} />
                        <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)}
                            className="bg-blue-600 text-white rounded-xl p-3 h-10 w-10 hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center flex-shrink-0 mb-1 shadow-md shadow-blue-500/20">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line · Upload PDF/DOCX for instant ATS analysis</p>
                </div>
            </div>
        </div>
    );
}
