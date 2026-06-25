import type { ParsedSections } from "../../types/resume.types";

interface Props {
  sections: ParsedSections;
  id?: string;
}

// Matches the target "professional blue" layout: sans-serif body, navy name,
// blue uppercase section headings each with a full-width blue rule.
const SANS = "'Calibri', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const TEXT = "#1a1a1a";
const MUTED = "#3d3d3d";
const HEADING = "#2f5496"; // section-heading blue
const NAME = "#1f3864";    // darker navy for the name
const RULE = "#2f5496";

export function ProfessionalTemplate({ sections, id }: Props) {
  const links = sections.links ?? {};
  const linkStyle: React.CSSProperties = { color: HEADING, textDecoration: "none" };

  return (
    <div
      id={id}
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: SANS,
        fontSize: "10.5pt",
        color: TEXT,
        padding: "40px 48px",
        boxSizing: "border-box",
        lineHeight: "1.38",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        {sections.name && (
          <div style={{ fontSize: "19pt", fontWeight: 700, letterSpacing: "0.06em", color: NAME, marginBottom: "3px" }}>
            {sections.name}
          </div>
        )}
        <div style={{ fontSize: "9.5pt", color: MUTED, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 6px" }}>
          {[
            sections.location && <span key="loc">{sections.location}</span>,
            sections.phone && <span key="ph">{sections.phone}</span>,
            sections.email && <a key="em" href={`mailto:${sections.email}`} style={{ color: MUTED, textDecoration: "none" }}>{sections.email}</a>,
            links.linkedin && <a key="li" href={links.linkedin} target="_blank" rel="noopener noreferrer" style={linkStyle}>LinkedIn</a>,
            links.github && <a key="gh" href={links.github} target="_blank" rel="noopener noreferrer" style={linkStyle}>GitHub</a>,
            links.medium && <a key="md" href={links.medium} target="_blank" rel="noopener noreferrer" style={linkStyle}>Medium</a>,
            links.portfolio && <a key="pf" href={links.portfolio} target="_blank" rel="noopener noreferrer" style={linkStyle}>Portfolio</a>,
          ].filter(Boolean).flatMap((el, i) => (i === 0 ? [el] : [<span key={`sep${i}`} style={{ color: "#9aa" }}>|</span>, el]))}
        </div>
      </div>

      {/* ── Professional Summary ── */}
      {sections.summary && (
        <Section title="Professional Summary">
          <p style={{ margin: 0, fontSize: "10pt", color: TEXT, lineHeight: "1.45", textAlign: "justify" }}>
            {sections.summary}
          </p>
        </Section>
      )}

      {/* ── Technical Skills ── */}
      {sections.skills.length > 0 && (
        <Section title="Technical Skills">
          {sections.skills.map((group) => (
            <div key={group.id} style={{ fontSize: "10pt", marginBottom: "2px" }}>
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
      )}

      {/* ── Professional Experience ── */}
      {sections.experience.length > 0 && (
        <Section title="Professional Experience">
          {sections.experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: "9px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: "10.5pt" }}>
                  {[exp.title, exp.company].filter(Boolean).join(" | ")}
                </span>
                {exp.dates && <span style={{ fontSize: "9.5pt", color: MUTED, whiteSpace: "nowrap", marginLeft: "12px" }}>{exp.dates}</span>}
              </div>
              {exp.bullets.map((b, i) => <Bullet key={i}>{b}</Bullet>)}
            </div>
          ))}
        </Section>
      )}

      {/* ── Projects ── */}
      {sections.projects.length > 0 && (
        <Section title="Projects">
          {sections.projects.map((proj) => {
            const extraBullets: string[] = (proj as { bullets?: string[] }).bullets ?? [];
            const descBullets = proj.description ? proj.description.split(/\n+/).map((s) => s.trim()).filter(Boolean) : [];
            const bullets = extraBullets.length > 0 ? extraBullets : descBullets;
            return (
              <div key={proj.id} style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  {proj.url ? (
                    <a href={proj.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: "10.5pt", color: TEXT, textDecoration: "none" }}>{proj.name}</a>
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: "10.5pt" }}>{proj.name}</span>
                  )}
                  {proj.tech.length > 0 && (
                    <span style={{ fontSize: "9.5pt", fontStyle: "italic", color: MUTED, whiteSpace: "nowrap", marginLeft: "12px" }}>
                      {proj.tech.join(", ")}
                    </span>
                  )}
                </div>
                {bullets.map((b, i) => <Bullet key={i}>{b}</Bullet>)}
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Education ── */}
      {sections.education.length > 0 && (
        <Section title="Education">
          {sections.education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: "5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: "10.5pt" }}>{edu.degree}</span>
                {edu.dates && <span style={{ fontSize: "9.5pt", color: MUTED, marginLeft: "12px", whiteSpace: "nowrap" }}>{edu.dates}</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "10pt", color: MUTED }}>
                {edu.school && <span style={{ fontStyle: "italic" }}>{edu.school}</span>}
                {edu.gpa && <span style={{ whiteSpace: "nowrap", marginLeft: "12px" }}>Score: {edu.gpa}</span>}
              </div>
              {edu.courses.length > 0 && (
                <div style={{ fontSize: "9.5pt", color: MUTED }}>Relevant coursework: {edu.courses.join(", ")}</div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── Certifications & Achievements ── */}
      {sections.certifications.length > 0 && (
        <Section title="Certifications & Achievements">
          {sections.certifications.map((cert) => <Bullet key={cert.id}>{cert.text}</Bullet>)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "11px" }}>
      <div style={{
        fontSize: "11pt",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: HEADING,
        borderBottom: `1.5px solid ${RULE}`,
        paddingBottom: "2px",
        marginBottom: "5px",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "7px", fontSize: "10pt", color: TEXT, lineHeight: "1.42", marginBottom: "2px", paddingLeft: "4px" }}>
      <span style={{ flexShrink: 0, color: HEADING }}>•</span>
      <span>{children}</span>
    </div>
  );
}
