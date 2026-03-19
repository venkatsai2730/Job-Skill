import { Router, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);

// ── GET /api/applications ── Fetch all applications for user
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("applications")
            .select("*")
            .eq("user_id", req.user!.userId)
            .order("date_applied", { ascending: false, nullsFirst: false });

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ applications: data || [] });
    } catch (err: any) {
        console.error("Get applications error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /api/applications/:id ── Fetch single application
router.get("/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabaseAdmin
            .from("applications")
            .select("*")
            .eq("id", id)
            .eq("user_id", req.user!.userId)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                 res.status(404).json({ error: "Application not found" });
                 return;
            }
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ application: data });
    } catch (err: any) {
        console.error("Get application error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/applications ── Create new application
router.post("/", async (req: AuthRequest, res: Response) => {
    try {
        const { company, role, status, date_applied, resume_id, interview_progress } = req.body;

        if (!company || !company.trim()) {
            res.status(400).json({ error: "Company name is required" });
            return;
        }
        if (!role || !role.trim()) {
            res.status(400).json({ error: "Role/Title is required" });
            return;
        }

        const { data, error } = await supabaseAdmin
            .from("applications")
            .insert({
                user_id: req.user!.userId,
                company: company.trim(),
                role: role.trim(),
                status: status || 'Applied',
                date_applied: date_applied || new Date().toISOString().split('T')[0],
                resume_id: resume_id || null,
                interview_progress: interview_progress || null
            })
            .select()
            .single();

        if (error) {
            // Handle unique constraint violation (code 23505 in Postgres)
            if (error.code === '23505') {
                 res.status(409).json({ error: "An application for this role at this company already exists." });
                 return;
            }
            res.status(400).json({ error: error.message });
            return;
        }

        res.status(201).json({ application: data });
    } catch (err: any) {
        console.error("Create application error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── PUT /api/applications/:id ── Update application
router.put("/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body; // company, role, status, date_applied, resume_id, interview_progress

        // Prevent updating protected fields
        delete updates.id;
        delete updates.user_id;
        delete updates.created_at;
        
        updates.updated_at = new Date().toISOString();

        // Check ownership first
        const { data: existing, error: findError } = await supabaseAdmin
            .from("applications")
            .select("id")
            .eq("id", id)
            .eq("user_id", req.user!.userId)
            .single();

        if (findError || !existing) {
             res.status(404).json({ error: "Application not found or unauthorized" });
             return;
        }

        const { data, error } = await supabaseAdmin
            .from("applications")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) {
             if (error.code === '23505') {
                 res.status(409).json({ error: "An application for this role at this company already exists." });
                 return;
            }
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ application: data });
    } catch (err: any) {
        console.error("Update application error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── DELETE /api/applications/:id ── Delete application
router.delete("/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

         // Check ownership
         const { data: existing, error: findError } = await supabaseAdmin
            .from("applications")
            .select("id")
            .eq("id", id)
            .eq("user_id", req.user!.userId)
            .single();

        if (findError || !existing) {
             res.status(404).json({ error: "Application not found" });
             return;
        }

        const { error } = await supabaseAdmin
            .from("applications")
            .delete()
            .eq("id", id);

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ message: "Application deleted successfully" });
    } catch (err: any) {
        console.error("Delete application error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
