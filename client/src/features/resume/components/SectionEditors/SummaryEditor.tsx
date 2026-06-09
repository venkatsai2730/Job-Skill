import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Dispatch } from "react";
import type { ResumeAction } from "../../types/patch.types";

interface Props {
  summary: string;
  dispatch: Dispatch<ResumeAction>;
}

export function SummaryEditor({ summary, dispatch }: Readonly<Props>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary);

  const commit = () => {
    if (draft.trim() !== summary) {
      dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.summary", value: draft.trim() }] });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setDraft(summary); setEditing(false); }
        }}
        className="w-full bg-surface-2 border border-blue-electric rounded-xl p-4 text-foreground text-sm leading-relaxed outline-none resize-none focus:ring-2 focus:ring-blue-electric/30"
      />
    );
  }

  return (
    <button
      type="button"
      className="group relative bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm cursor-text w-full text-left"
      onClick={() => { setDraft(summary); setEditing(true); }}
    >
      <Pencil className="w-3.5 h-3.5 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-white-60 hover:text-blue-electric" />
      {summary ? (
        <p className="text-foreground text-sm leading-relaxed">{summary}</p>
      ) : (
        <p className="text-white-30 italic text-sm">Click to add a professional summary…</p>
      )}
    </button>
  );
}
