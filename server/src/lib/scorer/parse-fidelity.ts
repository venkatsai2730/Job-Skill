// ═══════════════════════════════════════════════════════════════
// PARSE-FIDELITY — Detect ATS parsing failure modes in raw text
//
// Checks run on the extracted text string, not the PDF binary.
// Constraints:
//   • pdf-parse only returns { text: string } — no x/y coordinates
//   • No page count from the parser (estimated from text length)
//   • All checks must be text-only heuristics
// ═══════════════════════════════════════════════════════════════

import { normalizeHeader, type CanonicalSection } from './section-synonyms.js';
import { DEFAULT_CONFIG, type ScoringConfig } from './scoring-config.js';

export interface ParseFidelityReport {
    /** False = image-only PDF (text below threshold despite non-zero file size) */
    extractable: boolean;
    /** Risk that multi-column layout scrambled reading order */
    multiColumnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    /** Risk that table cell separators (pipes/tabs) pollute extracted text */
    tableArtifactRisk: 'LOW' | 'HIGH';
    /** 0–1: fraction of detected header candidates that map to a known section */
    sectionRecognitionRate: number;
    /** Raw header candidates found in the text (title-cased short lines) */
    detectedHeaders: string[];
    /** Canonical section names actually found via synonym map */
    recognizedSections: CanonicalSection[];
    /** Cumulative negative adjustment to apply to the ATS component score (≤ 0) */
    fidelityPenalty: number;
    /** Human-readable issue descriptions for the UI */
    flags: string[];
}

export function analyzeParseFidelity(
    rawText: string,
    metadata?: { fileSizeMB?: number; isPdf?: boolean; fileName?: string },
    config: ScoringConfig = DEFAULT_CONFIG,
): ParseFidelityReport {
    const F = config.parseFidelity;
    const lines = rawText.split('\n');
    const flags: string[] = [];
    let fidelityPenalty = 0;

    // ── 1. EXTRACTABILITY ────────────────────────────────────
    // Image-only PDFs: file has bytes but pdf-parse extracted no meaningful text
    const wordCount = rawText.trim().split(/\s+/).filter(w => w.length > 1).length;
    const fileMB = metadata?.fileSizeMB ?? 0;
    const isPdf = metadata?.isPdf ?? false;
    const extractable = !(isPdf && fileMB > 0.05 && wordCount < 50);
    if (!extractable) {
        flags.push('Image-only PDF: ATS cannot extract text from this resume');
        fidelityPenalty -= F.imageDeduction;
    }

    // ── 2. MULTI-COLUMN DETECTION ───────────────────────────
    // Signal: many short lines (< 45 chars) co-exist with longer ones.
    // Multi-column PDFs produce interleaved short fragments when linearized.
    const contentLines = lines.filter(l => l.trim().length > 8);
    let multiColumnRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (contentLines.length >= 12 && extractable) {
        const shortLines = contentLines.filter(l => l.trim().length < 45);
        const longLines  = contentLines.filter(l => l.trim().length > 65);
        const shortRatio = shortLines.length / contentLines.length;

        if (shortRatio > 0.60 && longLines.length >= 2) {
            multiColumnRisk = shortRatio > 0.75 ? 'HIGH' : 'MEDIUM';
        }
    }

    if (multiColumnRisk === 'HIGH') {
        flags.push('Multi-column layout likely: ATS may parse sections out of order');
        fidelityPenalty -= F.multiColDeduction;
    } else if (multiColumnRisk === 'MEDIUM') {
        fidelityPenalty -= Math.round((F.multiColDeduction / 2) * 10) / 10;
    }

    // ── 3. TABLE ARTIFACT DETECTION ─────────────────────────
    // Tables in PDFs often extract as pipe-separated or tab-separated text
    const pipeLines = lines.filter(l => (l.match(/\|/g) ?? []).length >= 2);
    const tabLines  = lines.filter(l => (l.match(/\t/g) ?? []).length >= 2);
    const tableArtifactRisk: 'LOW' | 'HIGH' =
        (pipeLines.length + tabLines.length) >= 4 ? 'HIGH' : 'LOW';

    if (tableArtifactRisk === 'HIGH') {
        flags.push('Table artifacts detected: pipe/tab separators may confuse ATS parsers');
        fidelityPenalty -= F.tableArtifactDeduction;
    }

    // ── 4. SECTION HEADER RECOGNITION ───────────────────────
    // Extract short lines that look like section headers:
    // - Title Case (e.g. "Work Experience") or ALL CAPS (e.g. "EDUCATION")
    // - Length 3–50 chars
    const headerCandidates = lines
        .map(l => l.trim())
        .filter(l => l.length >= 3 && l.length <= 50)
        .filter(l =>
            // Title Case: starts with capital, rest mixed
            /^[A-Z][a-zA-Z\s&\/\-]+$/.test(l) ||
            // ALL CAPS
            /^[A-Z][A-Z\s&\/\-]{2,}$/.test(l)
        )
        // Exclude lines that are clearly names or company names (contain numbers)
        .filter(l => !/\d/.test(l));

    const dedupedHeaders = [...new Set(headerCandidates)].slice(0, 25);

    const recognizedSectionSet = new Set<CanonicalSection>();
    for (const h of dedupedHeaders) {
        const canonical = normalizeHeader(h);
        if (canonical) recognizedSectionSet.add(canonical);
    }
    const recognizedSections = [...recognizedSectionSet];

    const sectionRecognitionRate = dedupedHeaders.length > 0
        ? recognizedSections.length / dedupedHeaders.length
        : 1;

    return {
        extractable,
        multiColumnRisk,
        tableArtifactRisk,
        sectionRecognitionRate,
        detectedHeaders: dedupedHeaders,
        recognizedSections,
        fidelityPenalty: Math.round(fidelityPenalty * 10) / 10,
        flags,
    };
}
