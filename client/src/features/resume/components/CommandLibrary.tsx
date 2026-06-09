import { useState } from "react";
import { Sparkles, ChevronRight, X } from "lucide-react";

export interface Command {
  label: string;
  prompt: string;
  category: "improve" | "optimize" | "fix" | "add";
}

const COMMANDS: Command[] = [
  // Improve
  { category: "improve", label: "Strengthen Summary", prompt: "Rewrite my professional summary with stronger action verbs and a compelling value proposition" },
  { category: "improve", label: "Power Up Bullets", prompt: "Rewrite all experience bullets to start with strong action verbs and quantify achievements" },
  { category: "improve", label: "Enhance Projects", prompt: "Rewrite projects section to better highlight technical complexity and business impact" },
  { category: "improve", label: "Elevate Language", prompt: "Improve the overall writing quality — make it more professional, concise, and impactful" },
  // Optimize
  { category: "optimize", label: "Boost ATS Score", prompt: "Optimize my resume for ATS systems by adding relevant tech keywords and improving keyword density" },
  { category: "optimize", label: "Add Metrics", prompt: "Add quantifiable metrics (percentages, numbers, dollar amounts) to all experience bullets" },
  { category: "optimize", label: "Match JD Keywords", prompt: "Add more industry-standard keywords to skills and experience sections to improve ATS matching" },
  { category: "optimize", label: "Tailor for Senior Role", prompt: "Adjust the language and emphasis to position me as a senior-level candidate with leadership potential" },
  // Fix
  { category: "fix", label: "Fix Grammar", prompt: "Fix all grammar, spelling, and punctuation errors throughout the resume" },
  { category: "fix", label: "Consistent Tense", prompt: "Make all experience bullets use consistent past tense for previous roles and present tense for current role" },
  { category: "fix", label: "Remove Filler Words", prompt: "Remove filler phrases like 'responsible for', 'helped with', 'worked on' and replace with strong verbs" },
  { category: "fix", label: "Trim Redundancy", prompt: "Identify and remove repetitive phrases and redundant information across sections" },
  // Add
  { category: "add", label: "Add Impact Statements", prompt: "Add impact statements to each experience entry showing the outcome and value delivered" },
  { category: "add", label: "Expand Skills", prompt: "Expand the skills section with relevant subcategories and additional technical competencies" },
  { category: "add", label: "Add Keywords", prompt: "Identify and add 10 important missing keywords that top tech employers look for" },
  { category: "add", label: "Strengthen Projects", prompt: "Enhance project descriptions with technical details, challenges solved, and quantified outcomes" },
];

const CATEGORY_LABELS: Record<Command["category"], string> = {
  improve: "Improve Writing",
  optimize: "Optimize for ATS",
  fix: "Fix Issues",
  add: "Add Content",
};

const CATEGORY_COLORS: Record<Command["category"], string> = {
  improve: "text-blue-400 bg-blue-400/10",
  optimize: "text-emerald-400 bg-emerald-400/10",
  fix: "text-amber-400 bg-amber-400/10",
  add: "text-purple-400 bg-purple-400/10",
};

interface Props {
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

export function CommandLibrary({ onSelect, onClose }: Props) {
  const [active, setActive] = useState<Command["category"]>("improve");
  const filtered = COMMANDS.filter((c) => c.category === active);

  return (
    <div className="bg-surface-1 border border-border/60 rounded-2xl shadow-2xl overflow-hidden w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-electric" />
          <span className="font-semibold text-foreground text-sm">Command Library</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-white-60 hover:text-foreground hover:bg-surface-2 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-border/60 overflow-x-auto">
        {(Object.entries(CATEGORY_LABELS) as [Command["category"], string][]).map(([cat, label]) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              active === cat
                ? "border-blue-electric text-blue-electric"
                : "border-transparent text-white-60 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Commands */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {filtered.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => { onSelect(cmd.prompt); onClose(); }}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-surface-2 group transition-colors"
          >
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0 ${CATEGORY_COLORS[cmd.category]}`}>
              {cmd.label.split(" ")[0]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-xs font-medium truncate">{cmd.label}</p>
              <p className="text-white-30 text-xs truncate">{cmd.prompt.slice(0, 55)}…</p>
            </div>
            <ChevronRight className="w-3 h-3 text-white-30 group-hover:text-blue-electric shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
