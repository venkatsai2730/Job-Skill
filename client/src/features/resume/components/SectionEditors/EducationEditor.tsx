import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import type { ResumeAction } from "../../types/patch.types";
import type { EducationEntry } from "../../types/resume.types";

interface Props {
  education: EducationEntry[];
  dispatch: Dispatch<ResumeAction>;
}

type EditKey = { entryIdx: number; field: keyof Pick<EducationEntry, "degree" | "school" | "dates" | "gpa"> };

interface EditableSpanProps {
  value: string;
  isActive: boolean;
  draft: string;
  className?: string;
  fieldName: string;
  onEdit: () => void;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function EditableSpan({ value, isActive, draft, className = "", fieldName, onEdit, onDraftChange, onCommit, onCancel }: Readonly<EditableSpanProps>) {
  return isActive ? (
    <input
      autoFocus value={draft} aria-label={fieldName}
      onChange={(e) => onDraftChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => { if (e.key === "Enter") { onCommit(); } else if (e.key === "Escape") { onCancel(); } }}
      className={`bg-surface-2 border border-blue-electric rounded px-2 py-0.5 outline-none ${className}`}
    />
  ) : (
    <button type="button" className={`cursor-text hover:bg-surface-2 rounded px-0.5 text-left ${className}`} onClick={onEdit}>
      {value || <span className="italic opacity-40">{fieldName}</span>}
    </button>
  );
}

export function EducationEditor({ education, dispatch }: Readonly<Props>) {
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [draft, setDraft] = useState("");

  const commit = () => {
    if (!editing) return;
    const { entryIdx, field } = editing;
    const trimmed = draft.trim();
    if (trimmed !== String(education[entryIdx][field])) {
      dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.education[${entryIdx}].${field}`, value: trimmed }] });
    }
    setEditing(null);
  };

  const startEdit = (entryIdx: number, field: EditKey["field"]) => {
    setDraft(String(education[entryIdx][field]));
    setEditing({ entryIdx, field });
  };

  const isEditingField = (entryIdx: number, field: EditKey["field"]) =>
    editing?.entryIdx === entryIdx && editing?.field === field;

  const removeEntry = (entryIdx: number) => {
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.education", value: education.filter((_, i) => i !== entryIdx) }] });
  };

  const addEntry = () => {
    const newEntry: EducationEntry = {
      id: crypto.randomUUID(),
      degree: "Bachelor of Science in Computer Science",
      school: "University Name",
      dates: "2020 – 2024",
      gpa: "",
      courses: [],
    };
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.education", value: [...education, newEntry] }] });
  };

  return (
    <div className="space-y-4">
      {education.map((edu, entryIdx) => (
        <div key={edu.id} className="group bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <EditableSpan
                value={String(edu.degree)} isActive={isEditingField(entryIdx, "degree")} draft={draft}
                className="font-semibold text-base text-foreground block" fieldName="degree"
                onEdit={() => startEdit(entryIdx, "degree")} onDraftChange={setDraft}
                onCommit={commit} onCancel={() => setEditing(null)}
              />
              <div className="flex gap-2 text-sm text-white-60 mt-0.5 flex-wrap">
                <EditableSpan
                  value={String(edu.school)} isActive={isEditingField(entryIdx, "school")} draft={draft}
                  fieldName="school"
                  onEdit={() => startEdit(entryIdx, "school")} onDraftChange={setDraft}
                  onCommit={commit} onCancel={() => setEditing(null)}
                />
                <span>·</span>
                <EditableSpan
                  value={String(edu.dates)} isActive={isEditingField(entryIdx, "dates")} draft={draft}
                  fieldName="dates"
                  onEdit={() => startEdit(entryIdx, "dates")} onDraftChange={setDraft}
                  onCommit={commit} onCancel={() => setEditing(null)}
                />
                {(edu.gpa || isEditingField(entryIdx, "gpa")) && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      GPA:
                      <EditableSpan
                        value={String(edu.gpa)} isActive={isEditingField(entryIdx, "gpa")} draft={draft}
                        fieldName="gpa"
                        onEdit={() => startEdit(entryIdx, "gpa")} onDraftChange={setDraft}
                        onCommit={commit} onCancel={() => setEditing(null)}
                      />
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              {edu.gpa && !isEditingField(entryIdx, "gpa") && (
                <span className="bg-blue-50 text-blue-electric text-xs px-2.5 py-1 rounded-full font-medium">GPA: {edu.gpa}</span>
              )}
              <button type="button" onClick={() => startEdit(entryIdx, "gpa")} title="Edit GPA" className="opacity-0 group-hover:opacity-100 p-1.5 text-white-60 hover:text-blue-electric rounded-lg transition-all">
                <Pencil className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => removeEntry(entryIdx)} title="Remove entry" className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addEntry} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-electric/30 hover:border-blue-electric text-blue-electric rounded-xl py-3 text-sm font-medium transition-colors">
        <Plus className="w-4 h-4" /> Add education entry
      </button>
    </div>
  );
}
