---
name: agent-add-node
description: Use when adding a new capability sub-agent or LangGraph node to the Aria agent graph — e.g. a new analysis/enrichment stage that should run between the planner and synthesis. Covers wiring the node, its state channel, the routing map, synthesis integration, and a test.
---

# agent-add-node

Scaffold a new capability sub-agent plus its LangGraph node, correctly wired into the
graph. Work through the steps in order. **Every new node MUST converge to `synthesis`
— never wire one straight to `END`.**

## Steps

1. **Sub-agent** — create `server/src/agents/<name>Agent.ts`. Mirror the shape of
   `server/src/agents/jobsAgent.ts` (class with `getSystemPrompt()`, `executeTool()`,
   `getAvailableTools()`, a `selectModelForTask(...)` config, and a singleton export
   like `export const <name>Agent = new <Name>Agent()`).

2. **Node** — create `server/src/graph/nodes/<name>Node.ts`. Signature:
   `(state: AgentGraphState) => Promise<Partial<AgentGraphState>>`.
   - First line MUST call `traceNodeExecution(state.traceId, "<name>", state)`
     (from `server/src/observability/langfuse.ts:79`).
   - Wrap work in try/catch; on error push to the `errors[]` channel and return —
     **never throw** (see `jobsAgentNode.ts:11` for the pattern).

3. **State channel** — in `server/src/graph/state.ts`:
   - add the field to `AgentGraphState` (`:61`),
   - add a matching `Annotation` in `GraphAnnotation` (`:105`),
   - add a default in `createInitialState()` (`:185`).
   - **Choose the reducer deliberately.** Branches fan out concurrently (step 4), so
     this matters. Use **append** `(a,b)=>[...a,...b]` if another node that runs in the
     same superstep may also write the field; use **replace** `(_,b)=>b` only when your
     node is the field's sole writer (as `resumeContext`/`dataContext`/`interviewContext`
     each are). State which you chose and why.

4. **Register in the graph** — `server/src/graph/langgraphOrchestrator.ts`:
   - `.addNode("<name>", <name>Node)` alongside the others (`:49-59`),
   - add `<name>: "<name>"` to the conditional-edge target map (`:74-82`),
   - `.addEdge("<name>", "synthesis")` (`:85-89`).
   - **Fan-out:** the planner's conditional edge uses `fanOutFromIntent()` which returns
     a `Send[]` (`langgraphOrchestrator.ts:70`), so every requested branch runs
     concurrently and converges on synthesis. Your node fires whenever its capability
     (step 5) is present — no priority ordering, no dropped branches.

5. **Capability + routing** — `server/src/graph/nodes/intentRouterNode.ts`:
   - add your capability string to the relevant intents in `INTENT_CAPABILITIES`
     (`:14`),
   - add a branch line in `routeFromIntent()` (`:76`), e.g.
     `if (caps.includes("<cap>")) branches.push("<name>");`
     (`fanOutFromIntent()` at `:110` turns each branch into a `Send`.)

6. **Synthesis** — teach `server/src/graph/nodes/synthesisNode.ts` to read your new
   context field. Extend `buildToolSummaries()` (`:145`) so the field's output is
   folded into the summary the LLM synthesizes from.

7. **Test** — add a vitest under `server/src/__tests__/` that invokes the node with a
   stub `AgentGraphState` and asserts your channel is populated and no error was
   pushed. Follow the existing style in
   `server/src/__tests__/interactionService.test.ts` (import the pure node module
   directly; avoid pulling in `config/supabase.js`, which needs env at load).

## Verify

```
cd server && npx tsc --noEmit && npm test
```
(`npm test` runs `vitest run`; `npx tsc --noEmit` type-checks without emitting.)

## Common mistakes
- Wiring the node to `END` instead of `synthesis` — breaks memory_write/final_response.
- Throwing instead of catching into `errors[]` — kills the whole graph run.
- Picking `replace` for a field two concurrent branches could write — branches now run
  in parallel, so this is silent data loss. Use `append` or give the field a sole writer.
- Forgetting synthesis integration — the node runs but its output never reaches the user.
