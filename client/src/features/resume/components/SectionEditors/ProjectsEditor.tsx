import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Dispatch } from "react";
import type { ResumeAction } from "../../types/patch.types";
import type { ProjectEntry } from "../../types/resume.types";

interface Props {
  projects: ProjectEntry[];
  dispatch: Dispatch<ResumeAction>;
}

type EditKey = { projectIdx: number; field: "name" | "description" };

export function ProjectsEditor({ projects, dispatch }: Readonly<Props>) {
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [draft, setDraft] = useState("");
  const [newTech, setNewTech] = useState<{ projectIdx: number; value: string } | null>(null);

  const commit = () => {
    if (!editing) return;
    const { projectIdx, field } = editing;
    const trimmed = draft.trim();
    if (trimmed !== projects[projectIdx][field]) {
      dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.projects[${projectIdx}].${field}`, value: trimmed }] });
    }
    setEditing(null);
  };

  const removeTech = (projectIdx: number, techIdx: number) => {
    const tech = projects[projectIdx].tech.filter((_, i) => i !== techIdx);
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.projects[${projectIdx}].tech`, value: tech }] });
  };

  const addTech = (projectIdx: number) => {
    if (newTech?.projectIdx !== projectIdx || !newTech?.value.trim()) { setNewTech(null); return; }
    const tech = [...projects[projectIdx].tech, newTech.value.trim()];
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: `sections.projects[${projectIdx}].tech`, value: tech }] });
    setNewTech(null);
  };

  const removeProject = (projectIdx: number) => {
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.projects", value: projects.filter((_, i) => i !== projectIdx) }] });
  };

  const addProject = () => {
    const newProject: ProjectEntry = {
      id: crypto.randomUUID(),
      name: "Project Name",
      description: "Brief description of the project and its impact",
      tech: ["React", "TypeScript"],
    };
    dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.projects", value: [...projects, newProject] }] });
  };

  return (
    <div className="space-y-4">
      {projects.map((proj, projectIdx) => (
        <div key={proj.id} className="group bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            {/* Name */}
            {editing?.projectIdx === projectIdx && editing.field === "name" ? (
              <input
                autoFocus value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === "Enter") { commit(); } else if (e.key === "Escape") { setEditing(null); } }}
                aria-label="Project name"
                className="font-semibold text-base bg-surface-2 border border-blue-electric rounded px-2 py-0.5 text-foreground outline-none flex-1 mr-2"
              />
            ) : (
              <button
                type="button"
                className="text-foreground font-semibold text-base cursor-text hover:bg-surface-2 rounded px-1 -mx-1 flex-1 text-left"
                onClick={() => { setDraft(proj.name); setEditing({ projectIdx, field: "name" }); }}
              >
                {proj.name}
              </button>
            )}
            <button type="button" onClick={() => removeProject(projectIdx)} title="Remove project" className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description */}
          {editing?.projectIdx === projectIdx && editing.field === "description" ? (
            <textarea
              autoFocus rows={3} value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Escape") { setEditing(null); } }}
              aria-label="Project description"
              className="w-full bg-surface-2 border border-blue-electric rounded px-2 py-1 text-sm text-foreground outline-none resize-none mb-3"
            />
          ) : (
            <button
              type="button"
              className="text-white-60 text-sm mb-3 cursor-text hover:bg-surface-2 rounded px-1 -mx-1 w-full text-left"
              onClick={() => { setDraft(proj.description); setEditing({ projectIdx, field: "description" }); }}
            >
              {proj.description || <span className="italic opacity-40">Click to add description</span>}
            </button>
          )}

          {/* Tech tags */}
          <div className="flex flex-wrap gap-2">
            {proj.tech.map((t, techIdx) => (
              <span key={`${proj.id}-${t}`} className="group/tech flex items-center gap-1 bg-surface-2 text-foreground text-xs px-2.5 py-1 rounded-full">
                {t}
                <button type="button" onClick={() => removeTech(projectIdx, techIdx)} title={`Remove ${t}`} className="opacity-0 group-hover/tech:opacity-100 transition-opacity">
                  <X className="w-2.5 h-2.5 text-red-400" />
                </button>
              </span>
            ))}
            {newTech?.projectIdx === projectIdx ? (
              <input
                autoFocus value={newTech.value}
                onChange={(e) => setNewTech({ projectIdx, value: e.target.value })}
                onBlur={() => addTech(projectIdx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { addTech(projectIdx); }
                  else if (e.key === "Escape") { setNewTech(null); }
                }}
                placeholder="Tech…"
                className="bg-surface-2 border border-blue-electric rounded-full px-2.5 py-1 text-xs text-foreground outline-none w-20"
              />
            ) : (
              <button type="button" onClick={() => setNewTech({ projectIdx, value: "" })} className="flex items-center gap-1 border border-dashed border-blue-electric/40 hover:border-blue-electric text-blue-electric text-xs px-2 py-1 rounded-full transition-colors">
                <Plus className="w-2.5 h-2.5" /> Tech
              </button>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={addProject} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-electric/30 hover:border-blue-electric text-blue-electric rounded-xl py-3 text-sm font-medium transition-colors">
        <Plus className="w-4 h-4" /> Add project
      </button>
    </div>
  );
}
