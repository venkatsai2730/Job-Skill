---
name: agent-parity-check
description: Use when verifying the legacy Aria loop and the LangGraph orchestrator produce equivalent responses — before flipping USE_LANGGRAPH, after changing intents/tools/routing, or when a message behaves differently with the flag on vs off. Flags divergent tools/providers, silent legacy fallbacks, and fan-out ordering gaps where a graph branch can't see another branch's output.
---

# agent-parity-check

Verify the legacy `runAriaAgent` loop and the LangGraph orchestrator produce
equivalent responses, so the `USE_LANGGRAPH` flag (`server/src/config/featureFlags.ts:16`)
stays safe to flip.

## Test messages (default set)
Cover one per intent family: `job_search`, `resume_rewrite`/`resume_edit`,
`interview_prep`, `cover_letter`, `career_roadmap`, `general_chat`.

## Procedure

1. **Run each message twice** — once with `USE_LANGGRAPH=false`, once with
   `USE_LANGGRAPH=true`. Legacy path = `server/src/agent/ariaAgent.ts:114`; LangGraph
   path = `server/src/graph/langgraphOrchestrator.ts:115` (delegated from
   `ariaAgent.ts:116`).

2. **Compare the response contract field by field.** Both paths return the same shape
   (`AgentResponse`, `ariaAgent.ts:18` / `LangGraphAgentResponse`,
   `langgraphOrchestrator.ts:33`):
   - `message` — compare **semantically**, not byte-for-byte (different models/temps).
   - `intent` — must match exactly.
   - `toolsUsed[]` / `steps[]` — must select the same tools.
   - `aria_edit` / `resume_patch` — structured payloads must match in presence + shape.

3. **Flag divergent routing.** For each intent, compare:
   - tools chosen by `planTools()` / `INTENT_TOOL_MAP` (`intentClassifier.ts:18,190`)
     vs the LangGraph branch that fires,
   - provider/model: runtime router `FEATURE_MODEL_MAP` (`chatService.ts:467`) should
     be identical on both paths (both call `getAIReply`).

4. **Flag silent legacy fallbacks.** With the flag ON, grep runtime logs for
   `"[Agent] LangGraph fallback to legacy"` (`ariaAgent.ts:143`). A hit means LangGraph
   threw and legacy answered — parity is *masked*, not proven.

5. **Flag ordering-dependent multi-branch intents.** Multi-capability intents
   (`INTENT_CAPABILITIES`, `intentRouterNode.ts:14`) now fan out: every branch runs
   concurrently via `fanOutFromIntent()` (`:110`, dispatched at
   `langgraphOrchestrator.ts:70`). This fixes the old `branches[0]`-only behaviour.
   The remaining divergence risk is **ordering**: the legacy loop runs planned tools
   *sequentially*, so a later tool sees earlier outputs; the graph runs branches in the
   *same superstep*, so it does not. Concretely, for intents combining `jobs` +
   `data_processing` (`career_roadmap`, `job_search`, `general_career`,
   `full_job_apply`), `data_agent`'s salary normalization / skill aggregation reads
   `state.jobsContext`, which is empty under fan-out — so those fields differ from
   legacy. Flag these intents and check whether the difference reaches the user's
   answer via synthesis.

## Live vs static
Live checks need the **aria MCP server running** (`mcp__aria__aria_health` should
respond; the `mcp__aria__aria_run_job_search` tool can exercise the job path). If the
MCP server is unavailable, **fall back to static analysis** of the routing maps
(`INTENT_TOOL_MAP`, `INTENT_CAPABILITIES`, `routeFromIntent`, `FEATURE_MODEL_MAP`) and
**say so explicitly** in the report — a static check proves routing parity, not output
parity.

## Output

A parity table plus a prioritized divergence list:

| message | legacy intent/tools | graph intent/tools | verdict |
|---------|---------------------|--------------------|---------|
| ...     | ...                 | ...                | ✅ / ⚠️ / ❌ |

Then, ordered by severity: intents where tools/providers differ, cases that hit the
legacy fallback, and `jobs`+`data_processing` intents where fan-out ordering diverges
from the legacy sequential run.

## Common mistakes
- Comparing `message` verbatim — expect wording drift; judge meaning.
- Declaring parity while the fallback log fired — that is legacy answering twice.
- Assuming graph still runs one branch — it now fans out all branches concurrently
  (`fanOutFromIntent`, `intentRouterNode.ts:110`); the live gap is ordering, not
  dropped branches.
