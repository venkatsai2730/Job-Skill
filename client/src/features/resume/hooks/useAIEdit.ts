import { useCallback } from "react";
import { useResumeStore } from "../store/resumeStore";
import type { ATSResult, ParsedSections } from "../types/resume.types";
import { ParsedSectionsSchema } from "../schemas/resume.schema";
import { sanitisePrompt } from "../utils/seedIds";

import { API_URL } from "../../../lib/config";

function getToken(): string {
  return localStorage.getItem("auth_token") ?? "";
}

// ── SSE line handler ───────────────────────────────────────────────
function processSSELine(
  line: string,
  prompt: string,
  appendStream: (t: string) => void,
  completeAIEdit: (s: ParsedSections, ats?: ATSResult, summary?: string, prompt?: string) => void,
  failAIEdit: () => void
): { stop: boolean; error?: Error } {
  if (!line.startsWith("data: ")) return { stop: false };
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return { stop: true };

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return { stop: false };
  }

  if (event.type === "token") {
    appendStream(event.text as string);
  } else if (event.type === "result") {
    // Validate with Zod — coerce missing fields to defaults
    const parsed = ParsedSectionsSchema.safeParse(event.sections);
    const sections: ParsedSections = parsed.success
      ? parsed.data
      : (event.sections as ParsedSections);
    completeAIEdit(
      sections,
      event.ats as ATSResult | undefined,
      event.summary as string,
      prompt
    );
  } else if (event.type === "error") {
    failAIEdit();
    return { stop: true, error: new Error(event.message as string) };
  }

  return { stop: false };
}

// ── Hook ───────────────────────────────────────────────────────────
export function useAIEdit() {
  const { startAIEdit, appendStream, completeAIEdit, failAIEdit, sections } =
    useResumeStore();

  const submit = useCallback(
    async (rawPrompt: string): Promise<void> => {
      const prompt = sanitisePrompt(rawPrompt);
      if (!prompt) return;

      startAIEdit();

      let response: Response;
      try {
        response = await fetch(`${API_URL}/api/resume/ai-edit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ prompt, sections }),
        });
      } catch {
        failAIEdit();
        throw new Error("Backend server is unreachable.");
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        failAIEdit();
        throw new Error(
          (err as { error?: string }).error || "AI edit request failed"
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        failAIEdit();
        throw new Error("Stream not available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const result = processSSELine(
              line,
              prompt,
              appendStream,
              completeAIEdit,
              failAIEdit
            );
            if (result.error) throw result.error;
            if (result.stop) return;
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    [sections, startAIEdit, appendStream, completeAIEdit, failAIEdit]
  );

  return { submit };
}
