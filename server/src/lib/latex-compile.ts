// ── LaTeX → PDF compilation ──
// Compiles a full .tex document to a PDF Buffer.
// Primary path: a cloud LaTeX compiler (texlive.net) — no local install needed.
// Fallback: local `pdflatex` if it happens to be on PATH.

import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// texlive.net runs a full TeX Live install (includes fontawesome5, titlesec, etc.)
const CLOUD_URL = process.env.LATEX_COMPILE_URL || "https://texlive.net/cgi-bin/latexcgi";

function hasLocalPdflatex(): boolean {
    try {
        execSync(process.platform === "win32" ? "where pdflatex" : "command -v pdflatex", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

// Compile via the cloud service. Returns a PDF Buffer or throws with the compile log.
async function compileViaCloud(tex: string): Promise<Buffer> {
    const form = new FormData();
    form.append("filename[]", "document.tex");
    form.append("filecontents[]", new Blob([tex], { type: "text/plain" }), "document.tex");
    form.append("engine", "pdflatex");
    form.append("return", "pdf");

    const resp = await fetch(CLOUD_URL, { method: "POST", body: form });
    const buf = Buffer.from(await resp.arrayBuffer());

    // A real PDF starts with "%PDF". Anything else is an error log.
    if (buf.subarray(0, 4).toString("latin1") === "%PDF") {
        return buf;
    }
    const log = buf.toString("utf-8").slice(0, 800);
    throw new Error(`LaTeX compile failed:\n${log}`);
}

// Compile via local pdflatex (two passes for cross-refs). Cleans up its temp dir.
function compileViaLocal(tex: string): Buffer {
    const workDir = join(tmpdir(), `latex-compile-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    const texPath = join(workDir, "resume.tex");
    const pdfPath = join(workDir, "resume.pdf");
    writeFileSync(texPath, tex, "utf-8");

    try {
        const cmd = `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${workDir}" "${texPath}"`;
        execSync(cmd, { timeout: 30000, stdio: "ignore" });
        execSync(cmd, { timeout: 30000, stdio: "ignore" });
        if (!existsSync(pdfPath)) throw new Error("PDF was not generated.");
        return readFileSync(pdfPath);
    } finally {
        try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
}

/**
 * Compile a complete LaTeX document into a PDF Buffer.
 * Tries local pdflatex first when available, otherwise uses the cloud compiler.
 */
export async function compileLatexToPdf(tex: string): Promise<Buffer> {
    if (hasLocalPdflatex()) {
        try {
            return compileViaLocal(tex);
        } catch (err: any) {
            console.warn("[latex-compile] local pdflatex failed, falling back to cloud:", err.message);
        }
    }
    return compileViaCloud(tex);
}
