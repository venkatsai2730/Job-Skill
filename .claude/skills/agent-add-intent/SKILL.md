---
name: agent-add-intent
description: Use when adding a brand-new user intent to the Aria agent — a new category of request the classifier should recognize and route (e.g. "negotiate offer", "referral finder"). Wires it end to end so it works on both the legacy loop and LangGraph: classifier, tools, capabilities, planner, model routing, and a test.
---

# agent-add-intent

Wire a new intent through the whole pipeline so it works on both the legacy loop
(`USE_LANGGRAPH` off) and the LangGraph orchestrator.

## Checklist

1. **Classifier** — `server/src/agent/intentClassifier.ts`:
   - add a regex/pattern rule in `classifyIntentRegex()` (`:52`) and/or a slash-command
     mapping (`:66`) so the fast path recognizes it,
   - the AI fallback (`classifyIntent`, `:153`) already offers every key of
     `INTENT_TOOL_MAP` as a choice, so step 2 also teaches the LLM path.

2. **Tools** — add an `INTENT_TOOL_MAP` entry (`intentClassifier.ts:18`) listing the
   tools this intent needs (empty `[]` = pure chat, no tools). Missing tools? Use
   `agent-add-tool`.

3. **Capabilities** — add an `INTENT_CAPABILITIES` entry in
   `server/src/graph/nodes/intentRouterNode.ts:14`. Capabilities are:
   `resume_analysis`, `jobs`, `web_context`, `data_processing`, `interview`. An empty
   array `[]` routes straight to synthesis (like `general_chat`).
   - **Fan-out:** every capability you list runs as its own branch concurrently —
     `fanOutFromIntent()` (`intentRouterNode.ts:110`) turns each branch from
     `routeFromIntent()` (`:76`) into a `Send`, dispatched at
     `server/src/graph/langgraphOrchestrator.ts:70`. All branches converge on synthesis.
     Caveat: `data_processing` (data_agent) can't see `jobs` results in the same
     superstep, so order-dependent enrichment won't chain.

4. **Parallelism** — capabilities already fan out (step 3), so no extra wiring is
   needed. The `parallelBranches` block in `server/src/graph/nodes/plannerNode.ts:56`
   is advisory metadata only — routing derives branches from `routeFromIntent()`, not
   from `plan.parallelBranches`.

5. **Model routing** — pick the provider/model:
   - the runtime chat router `FEATURE_MODEL_MAP` in
     `server/src/services/chatService.ts:467` (map the feature your tools call),
   - and the abstract policy `TASK_MODEL_MAP` in `server/src/agent/modelPolicy.ts:59`.
   - **Default to groq.** Use **gemini** only for structured-JSON or long-context work
     (e.g. `resume_edit` → gemini flash, `chatService.ts:485`); use **mistral** only
     for code generation (`code_gen` → codestral, `:476`).

6. **Legacy parity** — verify `planTools()` (`intentClassifier.ts:190`) produces a
   usable plan for the new intent with `USE_LANGGRAPH` off. The legacy loop
   (`ariaAgent.ts:114`) runs those tools directly; the LangGraph path reaches them via
   the capability branch. Both must work.

7. **Test** — add a classifier test under `server/src/__tests__/` (vitest) with 3+
   example phrasings that must resolve to the new intent. Follow the style of
   `server/src/__tests__/interactionService.test.ts`.

## Verify

```
cd server && npx tsc --noEmit && npm test
```

## Report table

End with a table so the wiring is auditable:

| intent | capabilities | branches (all run, parallel) | tools | provider/model |
|--------|--------------|------------------------------|-------|----------------|
| <name> | [...]        | resume_analysis, jobs, …     | [...] | groq/gemini/mistral |

## Common mistakes
- Adding to `INTENT_CAPABILITIES` but not `INTENT_TOOL_MAP` → LangGraph routes but the
  legacy loop has no tools (or vice-versa). Do both.
- Listing a `data_processing` capability that depends on `jobs` output — they run in the
  same superstep, so data_agent won't see jobs results.
- Choosing gemini/mistral for plain chat — default is groq.
