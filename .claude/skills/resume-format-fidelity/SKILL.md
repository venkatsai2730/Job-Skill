---
name: resume-format-fidelity
description: Use when working on resume editing that must PRESERVE the user's original look — the "faithful re-render" so AI-edited resumes still look like the uploaded PDF (fonts, sizes, spacing, small-caps headings) instead of snapping to a fixed template. Covers the StyleProfile pipeline (extract → store → render → export) and how to extend it.
---

# resume-format-fidelity

Make AI resume edits keep the user's original visual style. The system extracts a
**StyleProfile** (typography fingerprint) from the uploaded PDF and re-renders the
edited content through a look-alike template — the "faithful re-render" fidelity
target: visually close to the source, not byte-identical.

## Why this exists (the two lossy points)

The original pipeline throws formatting away twice:

1. **At parse** — `pdf-parse` `.getText()` (`server/src/routes/resume.ts` upload
   route) flattens the PDF to plain text; `parseSections()` reduces it to
   `ParsedSections` JSON. All fonts/colors/layout are gone here.
2. **At export after an edit** — a new PDF is regenerated from a LaTeX template
   (`/download/pdf-latex`) or DOCX built from scratch; the original look is lost.

The original binary is still in Supabase Storage and is returned bit-perfect by
`GET /api/resume/download/pdf` **only before the first AI edit**. After an edit the
editor switches to a re-rendered template.

## The pipeline (extract → store → render → export)

```
upload PDF ─▶ extractStyleProfile(buffer)      server/src/lib/resumeStyleProfile.ts
                    │  (pdfjs-dist getTextContent: per-glyph font/size/position)
                    ▼
             parsed_data.styleProfile           resume.ts ParsedData interface (:716)
                    │  (returned by /parsed, /upload, /reparse)
                    ▼
             store.styleProfile                 client resumeStore.ts
                    │
                    ▼
             <ResumePreview template="faithful" styleProfile=…>
                    │  → FaithfulTemplate.tsx  (renders sections in the mined style)
                    ▼
             Download PDF → exportPDF(PDF_PREVIEW_ID)   client html2canvas capture
                             (Resume.tsx handleDownloadPDF, faithful branch)
```

Key: **`pdf-parse.getText()` cannot see fonts.** Style extraction MUST use
`pdfjs-dist` (`getTextContent()` exposes `transform` (position + size), `fontName`,
and `styles[fontName].fontFamily` = "serif"/"sans-serif"/"monospace"). Keep the
plain `pdf-parse` path for text/ATS; run pdfjs only for the profile.

## What's implemented

- `server/src/lib/resumeStyleProfile.ts` — `StyleProfile` (schema **v2**) +
  `extractStyleProfile(buffer)` (defensive, never throws → `defaultStyleProfile()`)
  + pure `profileFromItems()` (unit-testable without pdfjs). Detects: body/heading/
  name sizes, serif vs sans, margins, **columns + sidebar side/width**, line-height,
  heading uppercase, bullet glyph, header alignment, **fill colors** (from the
  operator-list fill state aligned to each text-show op) and **bold weights** (from
  the loaded font name via `page.commonObjs`).
- Upload wiring in `resume.ts` — profile stored in `parsed_data.styleProfile`.
- Client `StyleProfile` type + `"faithful"` template id (`resume.types.ts`),
  `styleProfile` in the store, `FaithfulTemplate.tsx` (single- **and two-column**,
  color/bold-aware), `ResumePreview` dispatch, and `Resume.tsx` (capture on
  load/upload/reparse; default new uploads to `"faithful"`).
- **Vector PDF export** — `server/src/lib/faithful-latex.ts` builds a standalone
  profile-parameterized LaTeX doc (font family, sizes, colors, heading style)
  compiled via `latex-compile.ts`. `POST /download/pdf-latex` uses it when
  `templateId === "faithful"`; the client tries it and **falls back to the DOM
  raster** (`usePDFExport`) if compilation fails.
- **Faithful DOCX** — `GET /download/docx` drives `docx` `styles.default`
  (document run, title, heading1) from the profile — font, size, color, bold,
  uppercase headings, heading rule, header alignment.

## Extending it — remaining gaps, in priority order

1. **Two-column LaTeX/DOCX export.** `FaithfulTemplate` renders two columns on
   screen, but `faithful-latex.ts` and the DOCX builder are single-column only
   (LaTeX 2-col sidebars are fragile). For a 2-col original, export currently
   collapses to one column (PDF still falls back to the raster DOM capture, which
   *does* preserve two columns). Add a `paracol`/`minipage` LaTeX variant gated on
   `profile.columns === 2`.
2. **Section→column fidelity.** The 2-col split uses a fixed heuristic (skills/
   education/certs → sidebar). Capture the real per-section column from each
   heading's x-position during extraction and store a `columnAssignment` map.
3. **Small-caps detection.** `sectionHeadingStyle.smallCaps` is always `false`;
   detect it by comparing cap-height vs x-height clusters within a heading run.
4. **Persist template choice.** Uploads default to `"faithful"`; ensure
   `PUT /api/resume/template` accepts and round-trips the `"faithful"` id.

## Rules

- **Never block upload on style extraction.** It's best-effort; a bad PDF must
  still upload (the extractor already swallows errors → default profile).
- **Sizes in the profile are POINTS.** `FaithfulTemplate` scales pt→px at 96dpi
  (`* 96/72`). Keep that conversion if you add fields.
- **Old resumes have no profile.** Every consumer must tolerate
  `styleProfile == null` (FaithfulTemplate falls back to a serif default; the
  DOCX/LaTeX generators use `?? default` on every field).
- **Faithful PDF = vector-LaTeX with a raster fallback.** `handleDownloadPDF`
  posts to `/download/pdf-latex` with `templateId: "faithful"` + the profile; on
  any throw it falls back to the DOM raster capture. Keep that try/catch — a
  profile that trips LaTeX must still download.
- **Never compile LaTeX blind.** `faithful-latex.ts` is untested against a live
  `pdflatex`; run `POST /download/pdf-latex` end-to-end after changing it and open
  the resulting PDF before shipping.

## Verify

```
cd server && npm install        # pulls pdfjs-dist (added to package.json)
cd server && npx tsc --noEmit && npm test
cd client && npx tsc --noEmit
```

Manual: upload a serif/LaTeX-style resume → confirm the profile stored in
`parsed_data.styleProfile` reports `fonts.bodyFamily: "serif"` and a name size
larger than body. Apply an AI edit → the preview should stay serif with the same
heading style, and **Download PDF** should match that preview.

## Common mistakes

- Using `pdf-parse` to get fonts → it only returns text. Use `pdfjs-dist`.
- Adding a `StyleProfile` field on the server but not the client copy in
  `resume.types.ts` (they're duplicated by design — keep them in sync).
- Forgetting a new template id in BOTH `ResumeTemplate` union and the
  `ResumePreview` switch → silent fallback to Classic.
