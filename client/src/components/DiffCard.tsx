// ═══════════════════════════════════════════════════════════════
// DiffCard — Before/After diff display for Aria chat bubbles
// Shows what Aria wants to change in the resume with Accept/Undo
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Undo2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import type { ResumePatchItem, ResumePatch } from "@/lib/resumeTypes";

// ── Section display names ─────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
    summary: "Professional Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
};

const OPERATION_LABELS: Record<string, string> = {
    update: "Updated",
    append: "Added",
    replace_bullet: "Replaced bullet",
    add_bullet: "Added bullet",
    delete_bullet: "Removed bullet",
};

// ── Safe value → display string (guards against LLM returning objects) ───────
function toDisplayText(val: any): string {
    if (typeof val === "string") return val;
    if (Array.isArray(val)) return val.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
    if (val == null) return "";
    return JSON.stringify(val, null, 2);
}

// ── Single Diff Item ──────────────────────────────────────────
function DiffItem({ patch }: { patch: ResumePatchItem }) {
    const [expanded, setExpanded] = useState(true);

    const beforeText = toDisplayText(patch.before);
    const afterText = toDisplayText(patch.after);
    const sectionLabel = SECTION_LABELS[patch.section] || patch.section;
    const opLabel = OPERATION_LABELS[patch.operation] || patch.operation;

    return (
        <div className="rounded-lg overflow-hidden border border-gray-200/70 bg-white/50">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/80 hover:bg-gray-100/60 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <Pencil className="w-3 h-3 text-blue-500" />
                    <span className="text-[11px] font-semibold text-gray-800">
                        {opLabel}: {sectionLabel}
                    </span>
                    {patch.bullet_index !== undefined && (
                        <span className="text-[9px] text-gray-500 bg-gray-200/60 px-1.5 py-0.5 rounded">
                            bullet #{patch.bullet_index + 1}
                        </span>
                    )}
                </div>
                {expanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
            </button>

            {/* Before / After */}
            {expanded && (
                <div className="divide-y divide-gray-200/50">
                    {/* Before */}
                    {beforeText && patch.operation !== "add_bullet" && patch.operation !== "append" && (
                        <div className="px-3 py-2 bg-rose-50/60">
                            <p className="text-[9px] font-semibold text-rose-500 uppercase tracking-wider mb-1">Before</p>
                            <p className="text-[11px] text-rose-700/80 line-through leading-relaxed whitespace-pre-wrap">
                                {beforeText}
                            </p>
                        </div>
                    )}
                    {/* After */}
                    {afterText && patch.operation !== "delete_bullet" && (
                        <div className="px-3 py-2 bg-emerald-50/60">
                            <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">After</p>
                            <p className="text-[11px] text-emerald-800 font-medium leading-relaxed whitespace-pre-wrap">
                                {afterText}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// DiffCard — Full card with all patch items + Accept/Undo
// ═══════════════════════════════════════════════════════════════
interface DiffCardProps {
    patch: ResumePatch;
    onAccept: (patch: ResumePatch) => void;
    onUndo: () => void;
    isAccepted: boolean;
}

export function DiffCard({ patch, onAccept, onUndo, isAccepted }: DiffCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 space-y-2"
        >
            {/* Explanation */}
            {patch.explanation && (
                <p className="text-[11px] text-gray-600 leading-relaxed px-0.5">
                    {patch.explanation}
                </p>
            )}

            {/* Diff items */}
            <div className="space-y-1.5">
                {patch.patches.map((item, idx) => (
                    <DiffItem key={idx} patch={item} />
                ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
                {!isAccepted ? (
                    <button
                        onClick={() => onAccept(patch)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                            bg-gradient-to-r from-emerald-500 to-green-500 text-white
                            hover:from-emerald-600 hover:to-green-600
                            shadow-sm shadow-emerald-500/20 transition-all
                            focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accept Changes
                    </button>
                ) : (
                    <>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                        </span>
                        <button
                            onClick={onUndo}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                                text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200
                                transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                            <Undo2 className="w-3 h-3" />
                            Undo
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
}
