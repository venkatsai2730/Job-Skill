---
name: agent-add-tool
description: Use when adding a new callable tool/function to the Aria agent — a single-hop capability (score, fetch, generate, edit) that the intent classifier can select and both the legacy loop and LangGraph can execute. Covers the tool module, registry, intent mapping, dispatch, structured-payload extraction, and a test.
---

# agent-add-tool

Add a new tool to the Aria agent tool registry so both the legacy loop and the
LangGraph path can call it.

## Rules (state these up front)
- **Tools return, never throw.** Wrap the body in try/catch and return an
  error-shaped result (`{ error: "..." }`). `executeAgentTool()` already guards
  (`server/src/agent/tools/index.ts:58`), but a throwing tool still loses its output.
- **Respect `MAX_STEPS = 6`** (`server/src/agent/ariaAgent.ts:112`). A capability that
  needs more than one LLM/tool hop should be a **node** (use `agent-add-node`), not a
  tool.
- **Keep output JSON-serializable** — it is logged into the `toolCalls[]` state channel
  and truncated for tracing.

## Steps

1. **Pick the module** in `server/src/agent/tools/`: `resumeTools.ts`,
   `resumeEditTool.ts`, `jobTools.ts`, `interviewTools.ts`, `careerTools.ts`,
   `memoryTools.ts` — or create a new `<x>Tools.ts` exporting an `AgentTool[]`.

2. **Match the signature.** Each tool is an `AgentTool` (`tools/index.ts:26`):
   `{ name, description, parameters, execute(args, ctx) }`. Copy the export shape used
   in the chosen module (e.g. `export const jobTools: AgentTool[] = [...]`).

3. **Register** in `server/src/agent/tools/index.ts` — import the module and spread it
   into `ARIA_TOOLS` (`:42`). If you created a new module, add both.

4. **Map to intents** — add the tool name to `INTENT_TOOL_MAP` in
   `server/src/agent/intentClassifier.ts:18` for every intent that should reach it. If
   no existing intent fits, use `agent-add-intent` to create one.

5. **Confirm dispatch + reflection** — `executeAgentTool()` (`tools/index.ts:58`)
   dispatches by name via the `toolMap`, so registration is enough. Check
   `reflectOnStep()` (`intentClassifier.ts:235`) gives a sensible completion signal:
   single-tool intents complete after one success; multi-tool intents keep going so
   synthesis can combine outputs.

6. **Structured payloads consumed by the client.** If the tool returns a payload the
   UI applies (like `edit_resume` returning `aria_edit` — see `resumeEditTool.ts:132`),
   extend BOTH:
   - the extraction block in `ariaAgent.ts:187-195` (add your tool name + fields),
   - the response type + JSON in the route `server/src/routes/chatbot.ts`
     (`aria_edit`/`resume_patch` are surfaced at `:196-223`), and the `AgentResponse`
     type in `ariaAgent.ts:18`.

7. **Test** — add a unit test under `server/src/__tests__/` (vitest). Assert the tool
   returns the expected shape on success and an `{ error }` shape on failure. Follow
   `server/src/__tests__/interactionService.test.ts` (import the pure module; don't
   trigger `config/supabase.js` env loading).

## Verify

```
cd server && npx tsc --noEmit && npm test
```

## Common mistakes
- Tool throws on a bad API response → output lost and reflection misfires. Return
  `{ error }` instead.
- Registered in a module but the module isn't spread into `ARIA_TOOLS` → tool "not
  found in registry".
- New structured payload wired into `ariaAgent.ts` but not the route → client never
  sees it.
