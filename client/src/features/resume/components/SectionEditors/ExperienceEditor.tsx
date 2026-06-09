import { useState } from "react";
import { Pencil, Plus, Trash2, GripVertical } from "lucide-react";
import type { Dispatch } from "react";
import type { ResumeAction } from "../../types/patch.types";
import type { ExperienceEntry } from "../../types/resume.types";

interface Props {
  experience: ExperienceEntry[];
  dispatch: Dispatch<ResumeAction>;
}

interface EditingField {
  entryIdx: number;
  field: "title" | "company" | "dates" | "bullet";
  bulletIdx?: number;
}

export function ExperienceEditor({ experience, dispatch }: Readonly<Props>) {
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [draft, setDraft] = useState("");

  const commitField = () => {
    if (!editing) return;
    const { entryIdx, field, bulletIdx } = editing;
    if (field === "bullet" && bulletIdx !== undefined) {
      const trimmed = draft.trim();
      if (trimmed !== experience[entryIdx].bullets[bulletIdx]) {
        dispatch({
          type: "PATCH",
          patches: [{ op: "replace", path: `sections.experience[${entryIdx}].bullets[${bulletIdx}]`, value: trimmed }],
        });
      }
    } else if (field !== "bullet") {
      const trimmed = draft.trim();
      if (trimmed !== experience[entryIdx][field]) {
        dispatch({
          type: "PATCH",
          patches: [{ op: "replace", path: `sections.experience[${entryIdx}].${field}`, value: trimmed }],
        });
      }
    }
    setEditing(null);
  };

  const addBullet = (entryIdx: number) => {
    const bullets = [...experience[entryIdx].bullets, "New achievement with measurable impact"];
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.experience[${entryIdx}].bullets`, value: bullets }] });
  };

  const removeBullet = (entryIdx: number, bulletIdx: number) => {
    const bullets = experience[entryIdx].bullets.filter((_, i) => i !== bulletIdx);
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.experience[${entryIdx}].bullets`, value: bullets }] });
  };

  const removeEntry = (entryIdx: number) => {
    const updated = experience.filter((_, i) => i !== entryIdx);
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.experience", value: updated }] });
  };

  const addEntry = () => {
    const newEntry: ExperienceEntry = {
      id: crypto.randomUUID(),
      title: "Job Title",
      company: "Company Name",
      dates: "Jan 2024 – Present",
      bullets: ["Describe your key achievement with a measurable result"],
    };
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.experience", value: [...experience, newEntry] }] });
  };

  const isEditing = (entryIdx: number, field: string, bulletIdx?: number) =>
    editing?.entryIdx === entryIdx && editing?.field === field && editing?.bulletIdx === bulletIdx;

  const startEdit = (entryIdx: number, field: EditingField["field"], current: string, bulletIdx?: number) => {
    setDraft(current);
    setEditing({ entryIdx, field, bulletIdx });
  };

  const bulletStrength = (text: string) => (/\d/.test(text) ? "bg-emerald-500" : "bg-amber-500");

  return (
    <div className="space-y-4">
      {experience.map((exp, entryIdx) => (
        <div key={exp.id} className="group bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
          {/* Header row */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0">
              {/* Title */}
              {isEditing(entryIdx, "title") ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitField}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { commitField(); }
                    else if (e.key === "Escape") { setEditing(null); }
                  }}
                  className="font-semibold text-base bg-surface-2 border border-blue-electric rounded px-2 py-0.5 text-foreground outline-none w-full"
                />
              ) : (
                <button
                  type="button"
                  className="text-foreground font-semibold text-base cursor-text hover:bg-surface-2 rounded px-1 -mx-1 text-left"
                  onClick={() => startEdit(entryIdx, "title", exp.title)}
                >
                  {exp.title || <span className="text-white-30 italic">Title</span>}
                  <Pencil className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-40" />
                </button>
              )}

              {/* Company + dates */}
              <div className="flex gap-2 text-sm text-white-60 mt-0.5">
                {isEditing(entryIdx, "company") ? (
                  <input
                    autoFocus value={draft} aria-label="Company"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitField}
                    onKeyDown={(e) => { if (e.key === "Enter") { commitField(); } else if (e.key === "Escape") { setEditing(null); } }}
                    className="bg-surface-2 border border-blue-electric rounded px-2 py-0.5 outline-none flex-1"
                  />
                ) : (
                  <button
                    type="button"
                    className="cursor-text hover:bg-surface-2 rounded px-0.5 text-left"
                    onClick={() => startEdit(entryIdx, "company", exp.company)}
                  >
                    {exp.company || <span className="italic opacity-50">Company</span>}
                  </button>
                )}
                <span>·</span>
                {isEditing(entryIdx, "dates") ? (
                  <input
                    autoFocus value={draft} aria-label="Dates"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitField}
                    onKeyDown={(e) => { if (e.key === "Enter") { commitField(); } else if (e.key === "Escape") { setEditing(null); } }}
                    className="bg-surface-2 border border-blue-electric rounded px-2 py-0.5 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    className="cursor-text hover:bg-surface-2 rounded px-0.5 text-left"
                    onClick={() => startEdit(entryIdx, "dates", exp.dates)}
                  >
                    {exp.dates || <span className="italic opacity-50">Dates</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Current badge + delete */}
            <div className="flex items-center gap-2 ml-3">
              {exp.dates?.toLowerCase().includes("present") && (
                <span className="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-medium">Current</span>
              )}
              <button type="button" onClick={() => removeEntry(entryIdx)} title="Remove entry" className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bullets */}
          <ul className="space-y-2">
            {exp.bullets.map((bullet, bulletIdx) => (
              <li key={`${exp.id}-${bullet.slice(0, 30)}`} className="flex gap-2 group/bullet">
                <GripVertical className="w-3.5 h-3.5 text-white-30 mt-2 shrink-0 opacity-0 group-hover/bullet:opacity-100" />
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${bulletStrength(bullet)}`} />
                {isEditing(entryIdx, "bullet", bulletIdx) ? (
                  <textarea
                    autoFocus rows={2} aria-label="Bullet point"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitField}
                    onKeyDown={(e) => { if (e.key === "Escape") { setEditing(null); } }}
                    className="flex-1 bg-surface-2 border border-blue-electric rounded px-2 py-1 text-sm text-foreground outline-none resize-none"
                  />
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-sm text-foreground cursor-text hover:bg-surface-2 rounded px-1 -mx-1 leading-relaxed text-left"
                    onClick={() => startEdit(entryIdx, "bullet", bullet, bulletIdx)}
                  >
                    {bullet}
                  </button>
                )}
                <button type="button" onClick={() => removeBullet(entryIdx, bulletIdx)} title="Remove bullet" className="opacity-0 group-hover/bullet:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded transition-all shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={() => addBullet(entryIdx)} className="mt-3 flex items-center gap-1.5 text-xs text-blue-electric hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add bullet
          </button>
        </div>
      ))}

      <button type="button" onClick={addEntry} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-electric/30 hover:border-blue-electric text-blue-electric rounded-xl py-3 text-sm font-medium transition-colors">
        <Plus className="w-4 h-4" /> Add experience entry
      </button>
    </div>
  );
}
