import { useState, useRef, useEffect } from "react";
import { Sparkles, Undo2, Redo2, Loader2, Send, History, Library } from "lucide-react";
import type { AIHistoryEntry } from "../types/resume.types";
import { CommandLibrary } from "./CommandLibrary";

interface Props {
  onSubmit: (prompt: string) => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isEditing: boolean;
  streamText: string;
  aiHistory: AIHistoryEntry[];
}

export function AIPromptBar({
  onSubmit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isEditing,
  streamText,
  aiHistory,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prompt) setError("");
  }, [prompt]);

  // Close command library on outside click
  useEffect(() => {
    if (!showCommands) return;
    const handler = (e: MouseEvent) => {
      if (!commandsRef.current?.contains(e.target as Node)) setShowCommands(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCommands]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isEditing) return;
    const p = prompt.trim();
    setPrompt("");
    setError("");
    try {
      await onSubmit(p);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI edit failed");
    }
  };

  const handleCommandSelect = (p: string) => {
    setPrompt(p);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  return (
    <div className="border-t border-border/60 bg-surface-1 shrink-0 relative">
      {/* Stream preview */}
      {isEditing && streamText && (
        <div className="px-4 pt-3 pb-0">
          <p className="text-xs text-white-60 font-mono line-clamp-2 bg-surface-2 rounded-lg px-3 py-2">
            {streamText}
            <span className="animate-pulse">▌</span>
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-4 pt-2">
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      {/* Prompt bar */}
      <div className="flex items-center gap-2 p-3">
        {/* Undo / Redo */}
        <button type="button" onClick={onUndo} disabled={!canUndo || isEditing} title="Undo (Ctrl+Z)"
          className="p-2 rounded-lg text-white-60 hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
          <Undo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo || isEditing} title="Redo (Ctrl+Y)"
          className="p-2 rounded-lg text-white-60 hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Input */}
        <div className="flex-1 flex items-center gap-2 bg-surface-2 border border-blue-muted/50 rounded-xl px-3 py-2.5 focus-within:border-blue-electric transition-colors">
          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSubmit(); }}
            placeholder=""
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-white-30"
            disabled={isEditing}
            maxLength={500}
          />
        </div>

        {/* Command Library */}
        <div ref={commandsRef} className="relative">
          <button type="button" onClick={() => { setShowCommands((p) => !p); setShowHistory(false); }}
            title="Command library"
            className={`p-2 rounded-lg transition-colors shrink-0 ${showCommands ? "bg-blue-electric/10 text-blue-electric" : "text-white-60 hover:text-foreground hover:bg-surface-2"}`}>
            <Library className="w-4 h-4" />
          </button>
          {showCommands && (
            <div className="absolute bottom-full right-0 mb-2 z-50">
              <CommandLibrary onSelect={handleCommandSelect} onClose={() => setShowCommands(false)} />
            </div>
          )}
        </div>

        {/* History toggle */}
        <button type="button" onClick={() => { setShowHistory((p) => !p); setShowCommands(false); }} title="AI edit history"
          className={`p-2 rounded-lg transition-colors shrink-0 ${showHistory ? "bg-blue-electric/10 text-blue-electric" : "text-white-60 hover:text-foreground hover:bg-surface-2"}`}>
          <History className="w-4 h-4" />
        </button>

        {/* Submit */}
        <button type="button" onClick={handleSubmit} disabled={!prompt.trim() || isEditing}
          className="bg-blue-electric hover:bg-blue-bright disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-all shrink-0">
          {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">{isEditing ? "Editing…" : "Apply"}</span>
        </button>
      </div>

      {/* Suggestions / History */}
      {!prompt && !isEditing && !showHistory && !showCommands && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {["Improve my summary", "Add metrics to bullets", "Fix grammar", "Boost ATS score"].map((s) => (
            <button type="button" key={s} onClick={() => { setPrompt(s); inputRef.current?.focus(); }}
              className="text-xs text-white-60 hover:text-blue-electric bg-surface-2 hover:bg-blue-electric/10 px-2.5 py-1 rounded-full transition-colors border border-transparent hover:border-blue-electric/30">
              {s}
            </button>
          ))}
        </div>
      )}

      {showHistory && (
        <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
          {aiHistory.length === 0 ? (
            <p className="text-xs text-white-30 italic py-2">No AI edits yet</p>
          ) : (
            [...aiHistory].reverse().map((h) => (
              <div key={h.timestamp} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                <Sparkles className="w-3 h-3 text-blue-electric mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <button type="button" className="text-white-90 truncate text-left hover:text-blue-electric transition-colors w-full"
                    onClick={() => { setPrompt(h.prompt); setShowHistory(false); inputRef.current?.focus(); }}>
                    "{h.prompt}"
                  </button>
                  <p className="text-white-30">{h.summary}</p>
                </div>
                <span className="text-white-30 shrink-0">
                  {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
