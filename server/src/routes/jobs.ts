import { Router, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);

// GET /api/jobs - Fetch all jobs for the current user
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("jobs")
            .select("*")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false });

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ jobs: data });
    } catch (err: any) {
        console.error("Get jobs error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/jobs - Add a new job
router.post("/", async (req: AuthRequest, res: Response) => {
    try {
        const { company, role, location, salary, status, match_score, job_description, job_url } = req.body;

        if (!company || !role) {
            res.status(400).json({ error: "Company and role are required" });
            return;
        }

        const { data, error } = await supabaseAdmin
            .from("jobs")
            .insert({
                user_id: req.user!.userId,
                company,
                role,
                location,
                salary,
                status: status || "Saved",
                match_score: match_score || 0,
                job_description,
                job_url,
            })
            .select()
            .single();

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ job: data });
    } catch (err: any) {
        console.error("Add job error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// PATCH /api/jobs/:id - Update job (status, starred, etc.)
router.patch("/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabaseAdmin
            .from("jobs")
            .update(updates)
            .eq("id", id)
            .eq("user_id", req.user!.userId)
            .select()
            .single();

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ job: data });
    } catch (err: any) {
        console.error("Update job error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE /api/jobs/:id - Delete a job
router.delete("/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from("jobs")
            .delete()
            .eq("id", id)
            .eq("user_id", req.user!.userId);

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ message: "Job deleted successfully" });
    } catch (err: any) {
        console.error("Delete job error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
