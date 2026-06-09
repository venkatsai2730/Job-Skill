import { useState } from "react";
import { Clock, RotateCcw, Trash2, BookmarkPlus, GitCompare } from "lucide-react";
import type { ResumeVersion, ParsedSections } from "../types/resume.types";
import { DiffViewer } from "./DiffViewer";

interface Props {
  versions: ResumeVersion[];
  current: ParsedSections;
  onRestore: (version: ResumeVersion) => void;
  onDelete: (id: string) => void;
  onSave: (label?: string) => void;
}

export function VersionHistory({ versions, current, onRestore, onDelete, onSave }: Readonly<Props>) {
  const [diffVersion, setDiffVersion] = useState<ResumeVersion | null>(null);

  const handleSave = () => {
    const label = globalThis.prompt("Name this version (optional):");
    if (label === null) return;
    onSave(label || undefined);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-electric" /> Versions
          </h4>
          <button
            type="button"
            onClick={handleSave}
            title="Save current state as a version"
            className="flex items-center gap-1 text-xs text-blue-electric hover:underline"
          >
            <BookmarkPlus className="w-3.5 h-3.5" /> Save
          </button>
        </div>

        {versions.length === 0 ? (
          <p className="text-white-30 text-xs italic">
            No saved versions. Click Save to checkpoint the current state.
          </p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {[...versions].reverse().map((v) => (
              <div key={v.id} className="glass-card p-3 rounded-xl flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-medium truncate">{v.label}</p>
                  <p className="text-white-30 text-xs">
                    {new Date(v.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setDiffVersion(v)}
                    title="View diff"
                    className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    <GitCompare className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRestore(v)}
                    title="Restore this version"
                    className="p-1.5 rounded-lg text-blue-electric hover:bg-blue-electric/10 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (globalThis.confirm(`Delete version "${v.label}"?`)) onDelete(v.id);
                    }}
                    title="Delete this version"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {diffVersion && (
        <DiffViewer
          version={diffVersion}
          current={current}
          onClose={() => setDiffVersion(null)}
        />
      )}
    </>
  );
}
