import type { ParsedSections, StyleProfile } from "../../types/resume.types";

interface Props {
  sections: ParsedSections;
  /** Visual fingerprint of the original PDF. When absent, sensible defaults apply. */
  style?: StyleProfile;
  id?: string;
}

/**
 * FaithfulTemplate — re-renders the edited resume using the typography mined from
 * the user's ORIGINAL PDF (serif vs sans, name/heading/body sizes AND colors,
 * bold weights, line height, uppercase/small-caps headings, bullet glyph, header
 * alignment, and single- vs two-column layout). This is the "faithful re-render":
 * visually close to the source, edits reflow cleanly.
 *
 * Sizes in the profile are points; scaled to px at 96dpi (1pt = 1.333px). The
 * page is pinned to A4 width (794px) so PDF capture is deterministic.
 */

const PT_TO_PX = 96 / 72;
const A4_WIDTH_PX = 794;
const A4_MIN_HEIGHT_PX = 1123;

function px(pt: number): string {
  return `${(pt * PT_TO_PX).toFixed(1)}px`;
}

export function FaithfulTemplate({ sections, style, id }: Props) {
  const p: StyleProfile = style ?? FALLBACK;
  const links = sections.links ?? {};

  const bodyFont = cssFamily(p.fonts.bodyFamily);
  const headingFont = cssFamily(p.fonts.headingFamily);
  const smallCaps = p.sectionHeadingStyle.smallCaps;
  const upper = p.sectionHeadingStyle.uppercase && !smallCaps;

  const padX = clamp((p.page.marginLeft / p.page.width) * A4_WIDTH_PX, 40, 96);
  const padY = clamp((p.page.marginTop / p.page.height) * A4_MIN_HEIGHT_PX, 36, 90);

  const HEADING_COLOR = p.colors.sectionHeading;
  const NAME_COLOR = p.colors.name;
  const TEXT = p.colors.body;
  const MUTED = softenColor(p.colors.body);
  const w = p.weights ?? FALLBACK.weights;
  const nameWeight = w.nameBold ? 700 : 400;
  const headingWeight = w.headingBold ? 700 : 400;

  const linkStyle: React.CSSProperties = { color: TEXT, textDecoration: "none" };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: `${(0.6 * p.sizes.body * PT_TO_PX).toFixed(0)}px` }}>
      <div
        style={{
          fontFamily: headingFont,
          fontSize: px(p.sizes.sectionHeading),
          fontWeight: headingWeight,
          color: HEADING_COLOR,
          textTransform: upper ? "uppercase" : "none",
          fontVariant: smallCaps ? "small-caps" : "normal",
          letterSpacing: upper || smallCaps ? "0.04em" : "0",
          borderBottom: `1px solid ${HEADING_COLOR}`,
          paddingBottom: "2px",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );

  const Bullet = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", gap: "7px", fontSize: px(p.sizes.body), color: TEXT, lineHeight: String(p.lineHeight), marginBottom: "2px", paddingLeft: "4px" }}>
      <span style={{ flexShrink: 0, color: TEXT }}>{p.bulletGlyph}</span>
      <span>{children}</span>
    </div>
  );

  // ── Section blocks, keyed so a two-column layout can distribute them ──
  const blocks: Record<string, React.ReactNode> = {};

  if (sections.summary) {
    blocks.summary = (
      <Section title="Professional Summary">
        <p style={{ margin: 0, lineHeight: String(p.lineHeight), textAlign: "justify" }}>{sections.summary}</p>
      </Section>
    );
  }
  if (sections.skills.length > 0) {
    blocks.skills = (
      <Section title="Skills">
        {sections.skills.map((group) => (
          <div key={group.id} style={{ marginBottom: "2px" }}>
            {group.category && group.category !== "General" ? (
              <>
                <span style={{ fontWeight: 700 }}>{group.category}: </span>
                <span>{group.items.join(", ")}</span>
              </>
            ) : (
              <span>{group.items.join(", ")}</span>
            )}
          </div>
        ))}
      </Section>
    );
  }
  if (sections.experience.length > 0) {
    blocks.experience = (
      <Section title="Experience">
        {sections.experience.map((exp) => (
          <div key={exp.id} style={{ marginBottom: "9px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 700 }}>{[exp.title, exp.company].filter(Boolean).join(" | ")}</span>
              {exp.dates && <span style={{ fontSize: px(p.sizes.body * 0.92), color: MUTED, whiteSpace: "nowrap", marginLeft: "12px" }}>{exp.dates}</span>}
            </div>
            {exp.bullets.map((b, i) => <Bullet key={i}>{b}</Bullet>)}
          </div>
        ))}
      </Section>
    );
  }
  if (sections.projects.length > 0) {
    blocks.projects = (
      <Section title="Projects">
        {sections.projects.map((proj) => {
          const extraBullets: string[] = (proj as { bullets?: string[] }).bullets ?? [];
          const descBullets = proj.description ? proj.description.split(/\n+/).map((s) => s.trim()).filter(Boolean) : [];
          const bullets = extraBullets.length > 0 ? extraBullets : descBullets;
          return (
            <div key={proj.id} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                {proj.url ? (
                  <a href={proj.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: TEXT, textDecoration: "none" }}>{proj.name}</a>
                ) : (
                  <span style={{ fontWeight: 700 }}>{proj.name}</span>
                )}
                {proj.tech.length > 0 && (
                  <span style={{ fontSize: px(p.sizes.body * 0.92), fontStyle: "italic", color: MUTED, whiteSpace: "nowrap", marginLeft: "12px" }}>{proj.tech.join(", ")}</span>
                )}
              </div>
              {bullets.map((b, i) => <Bullet key={i}>{b}</Bullet>)}
            </div>
          );
        })}
      </Section>
    );
  }
  if (sections.education.length > 0) {
    blocks.education = (
      <Section title="Education">
        {sections.education.map((edu) => (
          <div key={edu.id} style={{ marginBottom: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 700 }}>{edu.degree}</span>
              {edu.dates && <span style={{ fontSize: px(p.sizes.body * 0.92), color: MUTED, marginLeft: "12px", whiteSpace: "nowrap" }}>{edu.dates}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: MUTED }}>
              {edu.school && <span style={{ fontStyle: "italic" }}>{edu.school}</span>}
              {edu.gpa && <span style={{ whiteSpace: "nowrap", marginLeft: "12px" }}>Score: {edu.gpa}</span>}
            </div>
            {edu.courses.length > 0 && (
              <div style={{ fontSize: px(p.sizes.body * 0.92), color: MUTED }}>Relevant coursework: {edu.courses.join(", ")}</div>
            )}
          </div>
        ))}
      </Section>
    );
  }
  if (sections.certifications.length > 0) {
    blocks.certifications = (
      <Section title="Certifications">
        {sections.certifications.map((cert) => <Bullet key={cert.id}>{cert.text}</Bullet>)}
      </Section>
    );
  }

  const Header = (
    <div style={{ textAlign: p.header.align, marginBottom: "8px" }}>
      {sections.name && (
        <div style={{ fontFamily: headingFont, fontSize: px(p.sizes.name), fontWeight: nameWeight, letterSpacing: "0.04em", color: NAME_COLOR, marginBottom: "3px" }}>
          {sections.name}
        </div>
      )}
      <div style={{ fontSize: px(p.sizes.body * 0.92), color: MUTED, display: "flex", justifyContent: p.header.align === "center" ? "center" : "flex-start", flexWrap: "wrap", gap: "0 6px" }}>
        {[
          sections.location && <span key="loc">{sections.location}</span>,
          sections.phone && <span key="ph">{sections.phone}</span>,
          sections.email && <a key="em" href={`mailto:${sections.email}`} style={linkStyle}>{sections.email}</a>,
          links.linkedin && <a key="li" href={links.linkedin} target="_blank" rel="noopener noreferrer" style={linkStyle}>LinkedIn</a>,
          links.github && <a key="gh" href={links.github} target="_blank" rel="noopener noreferrer" style={linkStyle}>GitHub</a>,
          links.medium && <a key="md" href={links.medium} target="_blank" rel="noopener noreferrer" style={linkStyle}>Medium</a>,
          links.portfolio && <a key="pf" href={links.portfolio} target="_blank" rel="noopener noreferrer" style={linkStyle}>Portfolio</a>,
        ]
          .filter(Boolean)
          .flatMap((el, i) => (i === 0 ? [el] : [<span key={`sep${i}`} style={{ color: MUTED }}>|</span>, el]))}
      </div>
    </div>
  );

  const pageStyle: React.CSSProperties = {
    width: `${A4_WIDTH_PX}px`,
    minHeight: `${A4_MIN_HEIGHT_PX}px`,
    backgroundColor: "#ffffff",
    fontFamily: bodyFont,
    fontSize: px(p.sizes.body),
    color: TEXT,
    padding: `${padY}px ${padX}px`,
    boxSizing: "border-box",
    lineHeight: String(p.lineHeight),
  };

  // ── Two-column layout (sidebar + main) when the original used one ──
  if (p.columns === 2 && p.sidebar) {
    const order = ["summary", "skills", "experience", "projects", "education", "certifications"];
    const sidebarKeys = ["skills", "education", "certifications"];
    const sidebar = order.filter((k) => sidebarKeys.includes(k) && blocks[k]);
    const main = order.filter((k) => !sidebarKeys.includes(k) && blocks[k]);
    const sideCol = (
      <div key="side" style={{ width: `${p.sidebar.widthPct}%`, boxSizing: "border-box" }}>
        {sidebar.map((k) => <div key={k}>{blocks[k]}</div>)}
      </div>
    );
    const mainCol = (
      <div key="main" style={{ width: `${100 - p.sidebar.widthPct}%`, boxSizing: "border-box" }}>
        {main.map((k) => <div key={k}>{blocks[k]}</div>)}
      </div>
    );
    return (
      <div id={id} style={pageStyle}>
        {Header}
        <div style={{ display: "flex", gap: "22px", alignItems: "flex-start" }}>
          {p.sidebar.side === "left" ? [sideCol, mainCol] : [mainCol, sideCol]}
        </div>
      </div>
    );
  }

  // ── Single-column layout ──
  const singleOrder = ["summary", "skills", "experience", "projects", "education", "certifications"];
  return (
    <div id={id} style={pageStyle}>
      {Header}
      {singleOrder.map((k) => (blocks[k] ? <div key={k}>{blocks[k]}</div> : null))}
    </div>
  );
}

function cssFamily(generic: string): string {
  switch (generic) {
    case "sans-serif":
      return "'Calibri', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    case "monospace":
      return "'Courier New', 'DejaVu Sans Mono', monospace";
    case "serif":
    default:
      return "'Times New Roman', Georgia, 'Latin Modern Roman', Cambria, serif";
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Nudge a body color toward a muted variant for secondary text. */
function softenColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#555555";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (140 - c) * 0.35);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const FALLBACK: StyleProfile = {
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
