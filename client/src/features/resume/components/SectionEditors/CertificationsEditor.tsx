import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import type { ResumeAction } from "../../types/patch.types";
import type { CertificationEntry } from "../../types/resume.types";

interface Props {
  certifications: CertificationEntry[];
  dispatch: Dispatch<ResumeAction>;
}

export function CertificationsEditor({ certifications, dispatch }: Readonly<Props>) {
  const [adding, setAdding] = useState("");

  const replaceAll = (next: CertificationEntry[]) =>
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.certifications", value: next }] });

  const editText = (idx: number, text: string) =>
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.certifications[${idx}].text`, value: text }] });

  const removeItem = (idx: number) => replaceAll(certifications.filter((_, i) => i !== idx));

  const addItem = () => {
    if (!adding.trim()) { setAdding(""); return; }
    replaceAll([...certifications, { id: crypto.randomUUID(), text: adding.trim() }]);
    setAdding("");
  };

  return (
    <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm space-y-3">
      {certifications.map((cert, idx) => (
        <div key={cert.id} className="group/cert flex items-start gap-2">
          <span className="text-blue-electric mt-2 select-none">•</span>
          <textarea
            value={cert.text}
            onChange={(e) => editText(idx, e.target.value)}
            rows={1}
            className="flex-1 resize-none bg-surface-2 border border-transparent hover:border-gray-200 focus:border-blue-electric rounded-lg px-3 py-1.5 text-sm text-foreground outline-none"
            placeholder="Certification or achievement…"
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            title="Remove"
            className="opacity-0 group-hover/cert:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded transition-all mt-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
          placeholder="Add a certification or achievement…"
          className="flex-1 bg-surface-2 border border-dashed border-blue-electric/40 focus:border-blue-electric rounded-lg px-3 py-1.5 text-sm text-foreground outline-none"
        />
        <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-blue-electric hover:underline">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}
