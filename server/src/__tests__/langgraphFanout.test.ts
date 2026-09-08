import { describe, it, expect } from "vitest";
import { StateGraph, END, Send } from "@langchain/langgraph";
// Pure modules only — state.ts + intentRouterNode.ts import nothing that needs
// env at load (no config/supabase.js), so this test runs fully offline.
import { GraphAnnotation, createInitialState } from "../graph/state.js";
import { fanOutFromIntent } from "../graph/nodes/intentRouterNode.js";
import type { AgentGraphState } from "../graph/state.js";

function stateWithCaps(caps: string[]): AgentGraphState {
    const s = createInitialState({
        userId: "u", sessionId: "s", message: "plan my career",
    }) as AgentGraphState;
    s.intent = {
        name: "career_roadmap",
        confidence: 90,
        entities: {},
        requestedCapabilities: caps,
    };
    return s;
}

describe("fanOutFromIntent", () => {
    it("dispatches ALL requested branches concurrently, not just branches[0]", () => {
        // career_roadmap → resume_analysis, jobs, data_processing
        const out = fanOutFromIntent(
            stateWithCaps(["resume_analysis", "jobs", "data_processing"])
        );
        expect(Array.isArray(out)).toBe(true);
        const sends = out as Send[];
        expect(sends).toHaveLength(3);
        expect(sends.every((s) => s instanceof Send)).toBe(true);
        expect(sends.map((s) => s.node).sort()).toEqual([
            "data_agent",
            "jobs_agent",
            "resume_analysis",
        ]);
    });

    it("routes empty-capability intents straight to synthesis", () => {
        expect(fanOutFromIntent(stateWithCaps([]))).toBe("synthesis");
    });
});

describe("GraphAnnotation reducers merge concurrent branch writes", () => {
    it("populates resumeContext, jobsContext and dataContext from parallel branches", async () => {
        // A minimal graph mirroring the real fan-out shape:
        //   planner → [3 branches via Send()] → synthesis → END
        // Uses the REAL GraphAnnotation channels + Send fan-out, no external calls.
        const g = new StateGraph(GraphAnnotation)
            .addNode("planner", async () => ({}))
            .addNode("resume_analysis", async () => ({
                resumeContext: { analysis: { get_resume_score: { score: 72 } } },
            }))
            .addNode("jobs_agent", async () => ({
                jobsContext: [{ tool: "search_jobs", result: { jobs: [] } }],
            }))
            .addNode("data_agent", async () => ({
                dataContext: { semanticJobs: [{ title: "SDE", company: "X", score: 0.9 }] },
            }))
            .addNode("synthesis", async () => ({ finalAnswer: "done" }))
            .addEdge("__start__", "planner")
            .addConditionalEdges("planner", () =>
                ["resume_analysis", "jobs_agent", "data_agent"].map(
                    (n) => new Send(n, {} as any)
                )
            )
            .addEdge("resume_analysis", "synthesis")
            .addEdge("jobs_agent", "synthesis")
            .addEdge("data_agent", "synthesis")
            .addEdge("synthesis", END)
            .compile();

        const final = await g.invoke(
            createInitialState({ userId: "u", sessionId: "s", message: "x" })
        );

        // All three parallel branches converged — no last-write-wins clobbering.
        expect(final.resumeContext?.analysis?.get_resume_score?.score).toBe(72);
        expect(final.jobsContext).toHaveLength(1);
        expect(final.dataContext?.semanticJobs).toHaveLength(1);
        expect(final.finalAnswer).toBe("done");
    });
});
