import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Dispatch } from "react";
import type { ResumeAction } from "../../types/patch.types";
import type { SkillGroup } from "../../types/resume.types";

interface Props {
  skills: SkillGroup[];
  dispatch: Dispatch<ResumeAction>;
}

export function SkillsEditor({ skills, dispatch }: Readonly<Props>) {
  const [newSkill, setNewSkill] = useState<{ groupIdx: number; value: string } | null>(null);
  const [editingCat, setEditingCat] = useState<{ groupIdx: number; value: string } | null>(null);

  const removeItem = (groupIdx: number, itemIdx: number) => {
    const items = skills[groupIdx].items.filter((_, i) => i !== itemIdx);
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.skills[${groupIdx}].items`, value: items }] });
  };

  const addItem = (groupIdx: number) => {
    if (newSkill?.groupIdx !== groupIdx || !newSkill?.value.trim()) {
      setNewSkill(null);
      return;
    }
    const items = [...skills[groupIdx].items, newSkill.value.trim()];
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.skills[${groupIdx}].items`, value: items }] });
    setNewSkill(null);
  };

  const renameCategory = (groupIdx: number) => {
    if (editingCat?.groupIdx !== groupIdx || !editingCat?.value.trim()) {
      setEditingCat(null);
      return;
    }
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.skills[${groupIdx}].category`, value: editingCat.value.trim() }] });
    setEditingCat(null);
  };

  const removeGroup = (groupIdx: number) => {
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.skills", value: skills.filter((_, i) => i !== groupIdx) }] });
  };

  const addGroup = () => {
    const newGroup: SkillGroup = { id: crypto.randomUUID(), category: "New Category", items: ["Skill"] };
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.skills", value: [...skills, newGroup] }] });
  };

  return (
    <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm space-y-5">
      {skills.map((group, groupIdx) => (
        <div key={group.id} className="group/group">
          <div className="flex items-center justify-between mb-2">
            {editingCat?.groupIdx === groupIdx ? (
              <input
                autoFocus value={editingCat.value}
                onChange={(e) => setEditingCat({ groupIdx, value: e.target.value })}
                onBlur={() => renameCategory(groupIdx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { renameCategory(groupIdx); }
                  else if (e.key === "Escape") { setEditingCat(null); }
                }}
                className="text-white-60 text-sm font-medium bg-surface-2 border border-blue-electric rounded px-2 py-0.5 outline-none"
              />
            ) : (
              <button
                type="button"
                className="text-white-60 text-sm font-medium cursor-text hover:text-blue-electric text-left"
                onClick={() => setEditingCat({ groupIdx, value: group.category })}
              >
                {group.category}
              </button>
            )}
            <button type="button" onClick={() => removeGroup(groupIdx)} title="Remove skill group" className="opacity-0 group-hover/group:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {group.items.map((skill, itemIdx) => (
              <span key={`${group.id}-${skill}`} className="group/item flex items-center gap-1 bg-blue-electric/8 text-blue-electric text-sm px-3 py-1.5 rounded-lg font-medium">
                {skill}
                <button type="button" onClick={() => removeItem(groupIdx, itemIdx)} title={`Remove ${skill}`} className="opacity-0 group-hover/item:opacity-100 transition-opacity ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Inline add skill */}
            {newSkill?.groupIdx === groupIdx ? (
              <input
                autoFocus
                value={newSkill.value}
                onChange={(e) => setNewSkill({ groupIdx, value: e.target.value })}
                onBlur={() => addItem(groupIdx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { addItem(groupIdx); }
                  else if (e.key === "Escape") { setNewSkill(null); }
                }}
                placeholder="Skill name…"
                className="bg-surface-2 border border-blue-electric rounded-lg px-3 py-1.5 text-sm text-foreground outline-none w-28"
              />
            ) : (
              <button type="button" onClick={() => setNewSkill({ groupIdx, value: "" })} className="flex items-center gap-1 border border-dashed border-blue-electric/40 hover:border-blue-electric text-blue-electric text-xs px-2.5 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={addGroup} className="flex items-center gap-2 text-xs text-blue-electric hover:underline pt-1">
        <Plus className="w-3.5 h-3.5" /> Add skill group
      </button>
    </div>
  );
}
