---
name: agent-trace
description: Use when you need to understand, explain, or debug what the Aria agent does with a specific user message or intent — which path runs (legacy vs LangGraph), how the message classifies, which nodes and tools fire, which state channels get written, and which LLM/provider each hop uses. Read-only.
---

# agent-trace

Trace exactly what the Aria agent will do with a given user message (or a named
intent), end to end, citing `file:line`. **This skill is read-only — never edit code.**

## When to use
- "What happens when a user says X?" / "Why did intent Y do Z?"
- Explaining or debugging the chat pipeline without running it
- Confirming which capabilities/branches/tools an intent maps to

## Trace procedure

Produce a numbered trace. Every step cites `file:line`. Steps:

1. **Which path runs.** Read `USE_LANGGRAPH` in `server/src/config/featureFlags.ts:16`.
   OFF ⇒ legacy loop `runAriaAgent()` in `server/src/agent/ariaAgent.ts:114`.
   ON ⇒ delegates to `runLangGraphAgent()` (`ariaAgent.ts:116`) but **falls back to
   legacy on any throw**, logging `"[Agent] LangGraph fallback to legacy"`
   (`ariaAgent.ts:143`).

2. **Resolve the intent.** `classifyIntent()` in
   `server/src/agent/intentClassifier.ts:153`. Regex path
   (`classifyIntentRegex`, `:52`) wins at confidence ≥ 75; otherwise a Groq call
   classifies. Report the resolved intent type + entities.

3. **Intent → capabilities.** Look the intent up in `INTENT_CAPABILITIES`
   (`server/src/graph/nodes/intentRouterNode.ts:14`). Capabilities are:
   `resume_analysis`, `jobs`, `web_context`, `data_processing`, `interview`.
   An empty list (e.g. `general_chat`) routes straight to synthesis.

4. **Capabilities → branches.** `routeFromIntent()`
   (`intentRouterNode.ts:76`) maps caps to node names in this fixed priority:
   `resume_analysis → jobs_agent → web_context → data_agent → interview_agent`.

5. **Which node(s) actually fire.** The planner's conditional edge calls
   `fanOutFromIntent()` (`intentRouterNode.ts:110`), which returns a **`Send[]` —
   every requested branch runs concurrently** in one superstep, then all converge on
   synthesis (`server/src/graph/langgraphOrchestrator.ts:70`). So for a multi-capability
   intent, list *all* the branches that fire, not just the first. (An empty/synthesis
   capability list returns the string `"synthesis"` and skips the agents.
   `plan.parallelBranches` computed in `plannerNode.ts:56` is advisory and NOT consulted
   by routing — `fanOutFromIntent` derives branches from `routeFromIntent`.)

6. **Tools.** `planTools()` (`intentClassifier.ts:190`) selects from
   `INTENT_TOOL_MAP` (`intentClassifier.ts:18`) for the intent and injects entities.
   In the legacy loop these run sequentially up to `MAX_STEPS = 6`
   (`ariaAgent.ts:112`); `reflectOnStep()` (`intentClassifier.ts:235`) stops after
   one success for single-tool intents.

7. **Provider/model per LLM hop.** Runtime chat calls resolve through
   `FEATURE_MODEL_MAP` in `server/src/services/chatService.ts:467` via `getAIReply()`
   (`chatService.ts:699`) — e.g. `chat`/`agent` → groq scout, `cover_letter` → groq
   maverick, `resume_edit` → gemini flash. The abstract task→model policy lives
   separately in `server/src/agent/modelPolicy.ts` (`TASK_MODEL_MAP:59`).

8. **State channels written.** For each firing node, list the `Partial<AgentGraphState>`
   keys it returns and the reducer (`server/src/graph/state.ts:105`):
   - **append** (`(a,b)=>[...a,...b]`): `jobsContext`, `webContext`, `ragContext`,
     `toolCalls`, `llmCalls`, `retrievals`, `errors`
   - **replace / last-write-wins** (`(_,b)=>b`): `resumeContext`, `dataContext`,
     `interviewContext`, `intent`, `plan`, `memories`, `finalAnswer`
   Synthesis (`server/src/graph/nodes/synthesisNode.ts:145`) reads these context
   fields to build the final answer.

9. **ASCII flow diagram** of the *actual* path for this message.

## Output format

A numbered trace (each step `file:line`), then the diagram. Example shape for a
`job_search` message (caps `["jobs","data_processing"]`, so branches
`["jobs_agent","data_agent"]` — **both run in parallel** via `Send()`):

```
message
  └─ intake → intent_router  (intent=job_search)
       └─ planner
            ├─ jobs_agent ─┐   (fan-out: Send() per branch)
            └─ data_agent ─┤
                           └─ synthesis → memory_write → final_response → END
```

For an empty-capability intent (`general_chat`) the diagram is
`intake → intent_router → planner → synthesis → memory_write → final_response → END`.

## Common mistakes
- Assuming only one branch runs — multi-capability intents now fan out concurrently
  via `fanOutFromIntent` (`intentRouterNode.ts:110`), all converging on synthesis.
- Citing `modelPolicy.ts` as the runtime router — live chat uses `FEATURE_MODEL_MAP`.
- Forgetting the LangGraph→legacy fallback can change the observed path.
- Expecting `data_agent` to see `jobs_agent`'s output — under fan-out they run in the
  same superstep, so `data_agent`'s jobs-dependent salary normalization is empty
  (its RAG `semanticJobs` path still populates).
