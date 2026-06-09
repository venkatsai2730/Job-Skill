import { useMemo } from "react";
import type { ParsedSections, ResumeVersion } from "../types/resume.types";
import { X } from "lucide-react";

// Simple word-level diff
type DiffToken = { text: string; kind: "same" | "added" | "removed" };

function wordDiff(a: string, b: string): DiffToken[] {
  const wa = a.split(/\s+/).filter(Boolean);
  const wb = b.split(/\s+/).filter(Boolean);
  const dp: number[][] = Array.from({ length: wa.length + 1 }, () => new Array(wb.length + 1).fill(0));
  for (let i = 1; i <= wa.length; i++)
    for (let j = 1; j <= wb.length; j++)
      dp[i][j] = wa[i - 1] === wb[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const tokens: DiffToken[] = [];
  let i = wa.length, j = wb.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wa[i - 1] === wb[j - 1]) {
      tokens.unshift({ text: wa[i - 1], kind: "same" });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({ text: wb[j - 1], kind: "added" });
      j--;
    } else {
      tokens.unshift({ text: wa[i - 1], kind: "removed" });
      i--;
    }
  }
  return tokens;
}

function DiffText({ a, b }: { a: string; b: string }) {
  const tokens = useMemo(() => wordDiff(a, b), [a, b]);
  return (
    <p className="text-xs leading-relaxed">
      {tokens.map((t, i) =>
        t.kind === "same" ? (
          <span key={i} className="text-foreground"> {t.text}</span>
        ) : t.kind === "added" ? (
          <span key={i} className="bg-emerald-500/20 text-emerald-400 rounded px-0.5"> {t.text}</span>
        ) : (
          <span key={i} className="bg-red-500/20 text-red-400 line-through rounded px-0.5"> {t.text}</span>
        )
      )}
    </p>
  );
}

function arrDiff<T extends { id?: string }>(
  a: T[],
  b: T[],
  label: (item: T) => string
): { text: string; kind: "added" | "removed" | "same" }[] {
  const labelsA = new Set(a.map(label));
  const labelsB = new Set(b.map(label));
  const result: { text: string; kind: "added" | "removed" | "same" }[] = [];
  a.forEach((item) => {
    result.push({ text: label(item), kind: labelsB.has(label(item)) ? "same" : "removed" });
  });
  b.forEach((item) => {
    if (!labelsA.has(label(item))) result.push({ text: label(item), kind: "added" });
  });
  return result;
}

interface Props {
  version: ResumeVersion;
  current: ParsedSections;
  onClose: () => void;
}

export function DiffViewer({ version, current, onClose }: Props) {
  const old = version.sections;

  const expDiff = arrDiff(old.experience, current.experience, (e) => `${e.title} @ ${e.company}`);
  const eduDiff = arrDiff(old.education, current.education, (e) => `${e.degree} — ${e.school}`);
  const skillsDiff = arrDiff(
    old.skills.flatMap((g) => g.items.map((i) => ({ id: i, item: i }))),
    current.skills.flatMap((g) => g.items.map((i) => ({ id: i, item: i }))),
    (s) => s.item
  );

  const hasSummaryChange = old.summary !== current.summary;
  const hasChanges = hasSummaryChange || expDiff.some((d) => d.kind !== "same") || eduDiff.some((d) => d.kind !== "same") || skillsDiff.some((d) => d.kind !== "same");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-surface-1 border border-border/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Diff — <span className="text-blue-electric">{version.label}</span></h3>
            <p className="text-xs text-white-30 mt-0.5">Comparing with current editor state</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white-60 hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 px-5 py-2 border-b border-border/40 text-xs shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500/30" /> Removed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/30" /> Added</span>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {!hasChanges && (
            <p className="text-white-60 text-sm text-center py-8">No differences found between this version and the current state.</p>
          )}

          {/* Summary diff */}
          {hasSummaryChange && (
            <DiffSection title="Summary">
              <DiffText a={old.summary} b={current.summary} />
            </DiffSection>
          )}

          {/* Experience diff */}
          {expDiff.some((d) => d.kind !== "same") && (
            <DiffSection title="Experience">
              {expDiff.map((d, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${d.kind === "added" ? "bg-emerald-500/10 text-emerald-400" : d.kind === "removed" ? "bg-red-500/10 text-red-400 line-through" : "text-white-60"}`}>
                  {d.kind === "added" ? "+ " : d.kind === "removed" ? "- " : "  "}{d.text}
                </div>
              ))}
            </DiffSection>
          )}

          {/* Education diff */}
          {eduDiff.some((d) => d.kind !== "same") && (
            <DiffSection title="Education">
              {eduDiff.map((d, i) => (
                <div key={i} className={`text-xs px-2 py-1 rounded ${d.kind === "added" ? "bg-emerald-500/10 text-emerald-400" : d.kind === "removed" ? "bg-red-500/10 text-red-400 line-through" : "text-white-60"}`}>
                  {d.kind === "added" ? "+ " : d.kind === "removed" ? "- " : "  "}{d.text}
                </div>
              ))}
            </DiffSection>
          )}

          {/* Skills diff */}
          {skillsDiff.some((d) => d.kind !== "same") && (
            <DiffSection title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {skillsDiff.map((d, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${d.kind === "added" ? "bg-emerald-500/20 text-emerald-400" : d.kind === "removed" ? "bg-red-500/20 text-red-400 line-through" : "bg-surface-3 text-white-60"}`}>
                    {d.text}
                  </span>
                ))}
              </div>
            </DiffSection>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-white-60 uppercase tracking-wider mb-2">{title}</h4>
      <div className="bg-surface-2 rounded-xl p-3 space-y-1">{children}</div>
    </div>
  );
}
