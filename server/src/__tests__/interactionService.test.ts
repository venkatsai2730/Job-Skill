import { describe, it, expect } from "vitest";
// Imports the PURE module directly, not interactionService.js — the
// latter pulls in config/supabase.js, which needs env vars at load.
import { normalizeEvents } from "../services/interactionEvents.js";

describe("normalizeEvents", () => {
    it("accepts a valid impression batch", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "job-a", event: "impression", position: 0, pool: "primary", score: 0.82 },
            { job_id: "job-b", event: "impression", position: 1, pool: "cross_domain", score: 0.41 },
        ]);
        expect(out).toHaveLength(2);
        expect(out[0]).toEqual({
            user_id: "user-1", job_id: "job-a", event: "impression",
            position: 0, pool: "primary", score: 0.82,
        });
    });

    it("drops events with an unknown event name", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "job-a", event: "hover" },
            { job_id: "job-b", event: "click" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].event).toBe("click");
    });

    it("drops events with a missing or blank job_id", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "", event: "click" },
            { event: "click" },
            { job_id: "job-ok", event: "click" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].job_id).toBe("job-ok");
    });

    it("nulls optional fields that are absent or unusable", () => {
        const out = normalizeEvents("user-1", [{ job_id: "job-a", event: "dismiss" }]);
        expect(out[0]).toMatchObject({ position: null, pool: null, score: null });
    });

    it("rejects an unknown pool value rather than storing it", () => {
        const out = normalizeEvents("user-1", [
            { job_id: "job-a", event: "impression", pool: "sponsored" },
        ]);
        expect(out[0].pool).toBeNull();
    });

    it("returns an empty array for non-array input", () => {
        expect(normalizeEvents("user-1", null)).toEqual([]);
        expect(normalizeEvents("user-1", { job_id: "x", event: "click" })).toEqual([]);
        expect(normalizeEvents("user-1", "click")).toEqual([]);
    });

    it("caps a batch at 200 rows so one request cannot flood the table", () => {
        const many = Array.from({ length: 500 }, (_, i) => ({ job_id: `job-${i}`, event: "impression" }));
        expect(normalizeEvents("user-1", many)).toHaveLength(200);
    });

    it("returns an empty array when userId is blank", () => {
        expect(normalizeEvents("", [{ job_id: "job-a", event: "click" }])).toEqual([]);
    });

    it("trims whitespace around job_id", () => {
        const out = normalizeEvents("user-1", [{ job_id: "  job-a  ", event: "click" }]);
        expect(out[0].job_id).toBe("job-a");
    });

    it("truncates a fractional position to an integer", () => {
        const out = normalizeEvents("user-1", [{ job_id: "job-a", event: "impression", position: 3.7 }]);
        expect(out[0].position).toBe(3);
    });
});
