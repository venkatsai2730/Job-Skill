/**
 * resumeStyleProfile — extract a "visual fingerprint" from the ORIGINAL uploaded
 * PDF so the editor can re-render an edited resume that still *looks like* the
 * user's document (serif vs sans, sizes, colors, bold, small-caps headings,
 * spacing, margins, columns) instead of forcing it into a fixed template.
 *
 * The plain `pdf-parse` .getText() path drops every styling signal. pdfjs-dist
 * exposes far more:
 *   - getTextContent(): per-item font family, glyph height (≈ size), position
 *   - getOperatorList(): the fill-color state at each text-drawing op (→ colors)
 *   - commonObjs: the loaded font's real name (→ bold / italic detection)
 *
 * Everything here is best-effort and defensive: any failure returns
 * `defaultStyleProfile()` so upload never breaks on a weird PDF.
 */

export interface StyleProfile {
  /** Schema version so we can migrate stored profiles later. */
  version: 2;
  page: {
    /** points (1/72 in). A4 ≈ 595×842, US-Letter ≈ 612×792. */
    width: number;
    height: number;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
  };
  columns: 1 | 2;
  /** For 2-column layouts: which side holds the narrow sidebar, and its width fraction. */
  sidebar: { side: "left" | "right"; widthPct: number } | null;
  fonts: {
    /** "serif" | "sans-serif" | "monospace" — pdfjs's generic classification. */
    bodyFamily: string;
    headingFamily: string;
  };
  /** Font sizes in points. */
  sizes: {
    name: number;
    sectionHeading: number;
    body: number;
  };
  colors: {
    name: string;
    sectionHeading: string;
    body: string;
  };
  weights: {
    nameBold: boolean;
    headingBold: boolean;
  };
  /** Ratio of line advance to body font size (≈ 1.15–1.5). */
  lineHeight: number;
  sectionHeadingStyle: {
    uppercase: boolean;
    smallCaps: boolean;
  };
  /** Leading glyph used for bullets, e.g. "•", "–", "-". */
  bulletGlyph: string;
  header: {
    align: "left" | "center";
  };
}

export function defaultStyleProfile(): StyleProfile {
  return {
    version: 2,
    page: { width: 595, height: 842, marginLeft: 54, marginRight: 54, marginTop: 54 },
    columns: 1,
    sidebar: null,
    fonts: { bodyFamily: "serif", headingFamily: "serif" },
    sizes: { name: 20, sectionHeading: 12, body: 10.5 },
    colors: { name: "#111111", sectionHeading: "#111111", body: "#222222" },
    weights: { nameBold: true, headingBold: true },
    lineHeight: 1.25,
    sectionHeadingStyle: { uppercase: true, smallCaps: false },
    bulletGlyph: "•",
    header: { align: "center" },
  };
}

interface Item {
  str: string;
  size: number; // pt
  x: number;
  y: number;
  family: string;
  bold: boolean;
  color: string; // hex, "#rrggbb"
}

const BULLET_CANDIDATES = ["•", "▪", "◦", "‣", "·", "–", "-", "*"];

function bucket(n: number): number {
  return Math.round(n * 2) / 2;
}

function mode(nums: number[]): number {
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = nums[0] ?? 0;
  let bestC = -1;
  for (const [n, c] of counts) {
    if (c > bestC) { bestC = c; best = n; }
  }
  return best;
}

function mode2(vals: string[]): string {
  const counts = new Map<string, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = vals[0] ?? "";
  let bestC = -1;
  for (const [v, c] of counts) {
    if (c > bestC) { bestC = c; best = v; }
  }
  return best;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Perceived luminance 0..255 — used to tell "near-black body ink" from accents. */
function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isNearBlack(hex: string): boolean {
  return luminance(hex) < 60;
}

/**
 * Pure analysis over already-extracted items — separated from PDF I/O so it can
 * be unit-tested without pdfjs.
 */
export function profileFromItems(items: Item[], pageWidth: number, pageHeight: number): StyleProfile {
  const d = defaultStyleProfile();
  const nonEmpty = items.filter((i) => i.str.trim().length > 0);
  if (nonEmpty.length < 3) {
    return { ...d, page: { ...d.page, width: pageWidth, height: pageHeight } };
  }

  const sizes = nonEmpty.map((i) => bucket(i.size));
  const bodySize = mode(sizes) || d.sizes.body;

  const topItems = nonEmpty.filter((i) => i.y > pageHeight * 0.75);
  const nameSize = topItems.length ? Math.max(...topItems.map((i) => bucket(i.size))) : Math.max(...sizes);

  const midSizes = sizes.filter((s) => s > bodySize + 0.5 && s < nameSize - 0.5);
  const headingSize = midSizes.length ? mode(midSizes) : Math.max(bodySize + 1.5, bodySize * 1.15);

  const bodyItems = nonEmpty.filter((i) => bucket(i.size) === bodySize);
  const bodyFamily = mode2(bodyItems.map((i) => i.family)) || d.fonts.bodyFamily;
  const headingItems = nonEmpty.filter((i) => bucket(i.size) === bucket(headingSize));
  const headingFamily = mode2(headingItems.map((i) => i.family)) || bodyFamily;
  const nameItem = topItems.sort((a, b) => b.size - a.size)[0];

  // ── Colors (from the operator-list fill state carried on each item) ──
  const bodyColorCandidates = bodyItems.map((i) => i.color).filter(isNearBlack);
  const bodyColor = bodyColorCandidates.length ? mode2(bodyColorCandidates) : mode2(bodyItems.map((i) => i.color)) || d.colors.body;
  const headingColor = mode2(headingItems.map((i) => i.color)) || bodyColor;
  const nameColor = nameItem?.color || headingColor;

  // ── Weights (from font-name bold flags) ──
  const headingBold = headingItems.length ? headingItems.filter((i) => i.bold).length / headingItems.length > 0.4 : true;
  const nameBold = nameItem ? nameItem.bold : true;

  // ── Margins ──
  const xs = nonEmpty.map((i) => i.x);
  const ys = nonEmpty.map((i) => i.y);
  const marginLeft = Math.max(0, Math.min(...xs));
  const marginRight = Math.max(0, pageWidth - Math.max(...xs));
  const marginTop = Math.max(0, pageHeight - Math.max(...ys));

  // ── Columns + sidebar side/width ──
  const rightItems = bodyItems.filter((i) => i.x > pageWidth * 0.5);
  const leftItems = bodyItems.filter((i) => i.x < pageWidth * 0.45);
  const twoCol = rightItems.length > 8 && leftItems.length > 8 && rightItems.length / (leftItems.length || 1) > 0.4;
  const columns: 1 | 2 = twoCol ? 2 : 1;
  let sidebar: StyleProfile["sidebar"] = null;
  if (twoCol) {
    // The sidebar is the column with fewer lines; width from the gap between clusters.
    const leftMax = Math.max(...leftItems.map((i) => i.x));
    const rightMin = Math.min(...rightItems.map((i) => i.x));
    if (leftItems.length <= rightItems.length) {
      sidebar = { side: "left", widthPct: clampPct(((leftMax - marginLeft) / pageWidth) * 100 + 6) };
    } else {
      sidebar = { side: "right", widthPct: clampPct(((pageWidth - rightMin - marginRight) / pageWidth) * 100 + 6) };
    }
  }

  // ── Line height ──
  const bodyYs = [...new Set(bodyItems.map((i) => Math.round(i.y)))].sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let i = 1; i < bodyYs.length; i++) {
    const g = bodyYs[i - 1] - bodyYs[i];
    if (g > 1 && g < bodySize * 3) gaps.push(g);
  }
  const lineHeight = gaps.length ? Math.min(2, Math.max(1, median(gaps) / bodySize)) : d.lineHeight;

  // ── Heading casing ──
  const headingTexts = headingItems.map((i) => i.str).filter((s) => s.trim().length > 1);
  const uppercase = headingTexts.length
    ? headingTexts.filter((s) => s === s.toUpperCase() && /[A-Z]/.test(s)).length / headingTexts.length > 0.6
    : d.sectionHeadingStyle.uppercase;

  // ── Bullet glyph ──
  const leadGlyphs = nonEmpty
    .map((i) => i.str.trim()[0])
    .filter((c): c is string => !!c && BULLET_CANDIDATES.includes(c));
  const bulletGlyph = leadGlyphs.length ? mode2(leadGlyphs) : d.bulletGlyph;

  // ── Header alignment ──
  const align: "left" | "center" =
    nameItem && Math.abs(nameItem.x - pageWidth / 2) < pageWidth * 0.18 && nameItem.x > pageWidth * 0.15 ? "center" : "left";

  return {
    version: 2,
    page: { width: pageWidth, height: pageHeight, marginLeft, marginRight, marginTop },
    columns,
    sidebar,
    fonts: { bodyFamily, headingFamily },
    sizes: { name: nameSize, sectionHeading: headingSize, body: bodySize },
    colors: { name: nameColor, sectionHeading: headingColor, body: bodyColor },
    weights: { nameBold, headingBold },
    lineHeight,
    sectionHeadingStyle: { uppercase, smallCaps: false },
    bulletGlyph,
    header: { align },
  };
}

function clampPct(n: number): number {
  return Math.max(24, Math.min(42, Math.round(n)));
}

/** Extract a StyleProfile from raw PDF bytes using pdfjs-dist. Never throws. */
export async function extractStyleProfile(buffer: Buffer): Promise<StyleProfile> {
  try {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const OPS = pdfjs.OPS;
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;

    const maxPages = Math.min(doc.numPages, 2);
    const items: Item[] = [];
    let pageWidth = 595;
    let pageHeight = 842;

    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      if (p === 1) { pageWidth = viewport.width; pageHeight = viewport.height; }

      // Operator list first: resolves fonts (for bold names) and lets us record
      // the fill color in effect at each text-drawing op, in content-stream order.
      const colorSequence: string[] = [];
      try {
        const opList = await page.getOperatorList();
        let cur = "#000000";
        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i];
          if (fn === OPS.setFillRGBColor) cur = rgbToHex(args[0], args[1], args[2]);
          else if (fn === OPS.setFillGray) cur = grayToHex(args[0]);
          else if (fn === OPS.setFillCMYKColor) cur = cmykToHex(args[0], args[1], args[2], args[3]);
          else if (fn === OPS.showText || fn === OPS.showSpacedText) colorSequence.push(cur);
        }
      } catch { /* color stays default black */ }

      const content = await page.getTextContent({ disableCombineTextItems: true });
      const styles = content.styles || {};
      // Align colors to items by index when the counts match (each show op ≈ one item).
      const alignColors = colorSequence.length === content.items.length;

      let idx = -1;
      for (const it of content.items) {
        if (typeof it.str !== "string") continue;
        idx++;
        const t = it.transform || [1, 0, 0, 1, 0, 0];
        const size = it.height || Math.hypot(t[2], t[3]) || 10;
        const family = normalizeFamily(styles[it.fontName]?.fontFamily || "serif");
        const bold = isBoldFont(page, it.fontName);
        const color = alignColors ? colorSequence[idx] : dominantOr(colorSequence, "#111111");
        items.push({ str: it.str, size, x: t[4], y: t[5], family, bold, color });
      }
    }

    try { await doc.cleanup(); await loadingTask.destroy(); } catch { /* ignore */ }

    return profileFromItems(items, pageWidth, pageHeight);
  } catch (err) {
    console.warn("[resumeStyleProfile] extraction failed, using default:", (err as Error)?.message);
    return defaultStyleProfile();
  }
}

/** Read the loaded font's real name from commonObjs and test for a bold weight. */
function isBoldFont(page: any, fontName: string): boolean {
  try {
    const font = page.commonObjs.get(fontName);
    const name: string = font?.name || "";
    return /bold|black|heavy|semibold|-bd|700|800|900/i.test(name);
  } catch {
    return false;
  }
}

function dominantOr(seq: string[], fallback: string): string {
  return seq.length ? mode2(seq) : fallback;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  // pdfjs passes RGB fill components as 0..255 integers.
  return "#" + [r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("");
}

function grayToHex(gray: number): string {
  const v = clampByte(gray * 255);
  return "#" + [v, v, v].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  return rgbToHex(r, g, b);
}

/** Collapse pdfjs font-family strings to a CSS-friendly generic. */
function normalizeFamily(f: string): string {
  const low = f.toLowerCase();
  if (low.includes("mono")) return "monospace";
  if (low.includes("sans")) return "sans-serif";
  if (low.includes("serif")) return "serif";
  if (/(times|georgia|garamond|cambria|minion|computer modern|latin modern)/.test(low)) return "serif";
  if (/(arial|helvetica|calibri|segoe|roboto|open sans|lato|verdana)/.test(low)) return "sans-serif";
  return "serif";
}
