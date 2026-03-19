import { Router, Request, Response } from "express";
import { ALL_TEMPLATES, LATEX_TEMPLATES, TemplateMetadata } from "../lib/latex-templates.js";
import { generateLatex } from "../lib/latex-generator.js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const router = Router();

// ═══════════════════════════════════════════════════════════════
//  GET /api/templates — All template metadata for frontend display
// ═══════════════════════════════════════════════════════════════
router.get("/", (_req: Request, res: Response) => {
    try {
        // Return metadata without the raw LaTeX code (too large for listing)
        const templates = ALL_TEMPLATES.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            description: t.description,
            tags: t.tags,
            isPopular: t.isPopular,
            atsScores: t.atsScores,
            // Simulated user counts for social proof (deterministic per template)
            users: Math.floor((t.atsScores.combined * 137 + t.id.length * 89) % 9000 + 1200),
            previewUrl: "" // No static previews; frontend renders placeholder
        }));

        res.json({ templates });
    } catch (err: any) {
        console.error("Fetch templates error:", err);
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/templates/:id — Single template metadata + LaTeX code
// ═══════════════════════════════════════════════════════════════
router.get("/:id", (req: Request, res: Response) => {
    try {
        const template = ALL_TEMPLATES.find(t => t.id === req.params.id);
        if (!template) {
            res.status(404).json({ error: `Template '${req.params.id}' not found` });
            return;
        }

        res.json({
            id: template.id,
            name: template.name,
            category: template.category,
            description: template.description,
            tags: template.tags,
            isPopular: template.isPopular,
            atsScores: template.atsScores,
            code: template.code
        });
    } catch (err: any) {
        console.error("Fetch template detail error:", err);
        res.status(500).json({ error: "Failed to fetch template" });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/templates/select — Auto-select best template(s)
// ═══════════════════════════════════════════════════════════════
router.post("/select", (req: Request, res: Response) => {
    try {
        const { category, targetRole } = req.body as { category?: string; targetRole?: string };

        let candidates = [...ALL_TEMPLATES];

        // 1. Filter by category if specified
        if (category) {
            const normalizedCat = category.toLowerCase().includes("non") ? "Non-IT" : "IT";
            candidates = candidates.filter(t => t.category === normalizedCat);
        }

        // 2. If a target role is specified, score by tag relevance
        if (targetRole) {
            const roleLower = targetRole.toLowerCase();
            candidates.sort((a, b) => {
                const scoreA = a.tags.filter(tag => roleLower.includes(tag.toLowerCase())).length
                    + (a.description.toLowerCase().includes(roleLower) ? 2 : 0);
                const scoreB = b.tags.filter(tag => roleLower.includes(tag.toLowerCase())).length
                    + (b.description.toLowerCase().includes(roleLower) ? 2 : 0);
                // Higher relevance first, then higher ATS score
                return (scoreB - scoreA) || (b.atsScores.combined - a.atsScores.combined);
            });
        } else {
            // Sort by ATS score descending
            candidates.sort((a, b) => b.atsScores.combined - a.atsScores.combined);
        }

        // Return top 5 recommendations (metadata only)
        const recommendations = candidates.slice(0, 5).map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            description: t.description,
            tags: t.tags,
            isPopular: t.isPopular,
            atsScores: t.atsScores
        }));

        res.json({ recommendations });
    } catch (err: any) {
        console.error("Template select error:", err);
        res.status(500).json({ error: "Failed to select template" });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/templates/compile — Fill template + compile via pdflatex
// ═══════════════════════════════════════════════════════════════
router.post("/compile", (req: Request, res: Response) => {
    const workDir = join(tmpdir(), `latex-compile-${randomUUID()}`);
    
    try {
        const { templateId, sections, userInfo } = req.body;

        // ── Validate inputs ─────────────────────────────────────
        if (!templateId) {
            res.status(400).json({ error: "templateId is required" });
            return;
        }
        if (!sections) {
            res.status(400).json({ error: "sections (resume parsed sections) are required" });
            return;
        }

        const template = ALL_TEMPLATES.find(t => t.id === templateId);
        if (!template) {
            res.status(404).json({ error: `Template '${templateId}' not found` });
            return;
        }

        // ── Generate the filled LaTeX source ─────────────────────
        const latexContent = generateLatex(sections, templateId, userInfo || {});

        // ── Write to temp directory ─────────────────────────────
        mkdirSync(workDir, { recursive: true });
        const texPath = join(workDir, "resume.tex");
        writeFileSync(texPath, latexContent, "utf-8");

        // ── Compile with pdflatex ──────────────────────────────
        try {
            // Run pdflatex twice for proper cross-references
            const pdflatexCmd = `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${workDir}" "${texPath}"`;
            execSync(pdflatexCmd, { timeout: 30000, stdio: "pipe" });
            // Second pass for references
            execSync(pdflatexCmd, { timeout: 30000, stdio: "pipe" });
        } catch (compileErr: any) {
            // ── Parse LaTeX compilation errors ───────────────────
            const logPath = join(workDir, "resume.log");
            let errorDetails = "LaTeX compilation failed";
            
            if (existsSync(logPath)) {
                const logContent = readFileSync(logPath, "utf-8");
                // Extract the first error line from the log
                const errorLines = logContent.split("\n").filter(l => l.startsWith("!") || l.includes("Error"));
                if (errorLines.length > 0) {
                    errorDetails = errorLines.slice(0, 5).join("\n");
                }
            }

            // Also return the generated .tex source so the user can debug
            res.status(422).json({
                error: "LaTeX compilation failed",
                details: errorDetails,
                texSource: latexContent,
                suggestion: "The template compiled with errors. Check that pdflatex is installed and that no special characters broke the LaTeX markup."
            });
            return;
        }

        // ── Read the compiled PDF ──────────────────────────────
        const pdfPath = join(workDir, "resume.pdf");
        if (!existsSync(pdfPath)) {
            res.status(500).json({
                error: "PDF was not generated despite successful compilation",
                texSource: latexContent
            });
            return;
        }

        const pdfBuffer = readFileSync(pdfPath);

        // ── Return the PDF ─────────────────────────────────────
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="ATS_Resume_${template.id}.pdf"`);
        res.send(pdfBuffer);

    } catch (err: any) {
        // Handle pdflatex not installed
        if (err.message?.includes("ENOENT") || err.message?.includes("not recognized") || err.message?.includes("not found")) {
            res.status(503).json({
                error: "pdflatex is not installed on this server",
                suggestion: "Install TeX Live or MiKTeX to enable server-side PDF compilation. The /api/resume/download/latex endpoint can still provide the raw .tex file for local compilation.",
                fallback: "/api/resume/download/latex"
            });
            return;
        }

        console.error("Template compile error:", err);
        res.status(500).json({ error: "Internal server error during compilation" });
    } finally {
        // ── Cleanup temp files ──────────────────────────────────
        try {
            if (existsSync(workDir)) {
                const files = readdirSync(workDir);
                for (const f of files) {
                    try { unlinkSync(join(workDir, f)); } catch {}
                }
                try { 
                    const { rmdirSync } = require("fs");
                    rmdirSync(workDir); 
                } catch {}
            }
        } catch {}
    }
});

export default router;
