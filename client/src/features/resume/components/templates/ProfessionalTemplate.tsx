import type { ParsedSections } from "../../types/resume.types";

interface Props {
  sections: ParsedSections;
  id?: string;
}

const SERIF = "'Georgia', 'Times New Roman', serif";
const TEXT = "#0a0a0a";
const MUTED = "#444";

export function ProfessionalTemplate({ sections, id }: Props) {
  const linkStyle: React.CSSProperties = { color: MUTED, textDecoration: "underline" };

  return (
    <div
      id={id}
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: SERIF,
        fontSize: "10.5pt",
        color: TEXT,
        padding: "44px 52px",
        boxSizing: "border-box",
        lineHeight: "1.4",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        {sections.name && (
          <div style={{
            fontSize: "18pt",
            fontWeight: "700",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: SERIF,
            marginBottom: "4px",
          }}>
            {sections.name}
          </div>
        )}
        <div style={{ fontSize: "9.5pt", color: MUTED, letterSpacing: "0.01em", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 8px" }}>
          {sections.phone && <span>{sections.phone}</span>}
          {sections.email && (
            <a href={`mailto:${sections.email}`} style={{ color: MUTED, textDecoration: "none" }}>
              {sections.email}
            </a>
          )}
          {sections.location && <span>{sections.location}</span>}
          {sections.links?.linkedin && (
            <a href={sections.links.linkedin} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              LinkedIn
            </a>
          )}
          {sections.links?.github && (
            <a href={sections.links.github} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              GitHub
            </a>
          )}
          {sections.links?.portfolio && (
            <a href={sections.links.portfolio} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Portfolio
            </a>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1.5px solid #000", marginBottom: "10px" }} />

      {/* ── Summary ── */}
      {sections.summary && (
        <Section title="Professional Summary">
          <p style={{ margin: 0, fontSize: "10pt", color: TEXT, lineHeight: "1.5", textAlign: "justify" }}>
            {sections.summary}
          </p>
        </Section>
      )}

      {/* ── Education ── */}
      {sections.education.length > 0 && (
        <Section title="Education">
          {sections.education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: "700", fontSize: "10.5pt" }}>{edu.degree}</span>
                {edu.dates && <span style={{ fontSize: "9.5pt", color: MUTED }}>{edu.dates}</span>}
              </div>
              {edu.school && (
                <div style={{ fontSize: "10pt", fontStyle: "italic", color: MUTED }}>{edu.school}</div>
              )}
              {edu.gpa && <div style={{ fontSize: "9.5pt", color: MUTED }}>GPA: {edu.gpa}</div>}
              {edu.courses.length > 0 && (
                <div style={{ fontSize: "9.5pt", color: MUTED }}>Relevant coursework: {edu.courses.join(", ")}</div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── Experience ── */}
      {sections.experience.length > 0 && (
        <Section title="Experience">
          {sections.experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: "700", fontSize: "10.5pt" }}>{exp.company || exp.title}</span>
                {exp.dates && <span style={{ fontSize: "9.5pt", color: MUTED, whiteSpace: "nowrap", marginLeft: "12px" }}>{exp.dates}</span>}
              </div>
              {exp.title && exp.company && (
                <div style={{ fontSize: "10pt", fontStyle: "italic", color: MUTED, marginBottom: "2px" }}>{exp.title}</div>
              )}
              {exp.bullets.map((b, i) => (
                <Bullet key={i}>{b}</Bullet>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* ── Projects ── */}
      {sections.projects.length > 0 && (
        <Section title="Projects">
          {sections.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ flex: 1 }}>
                  {proj.url ? (
                    <a href={proj.url} target="_blank" rel="noopener noreferrer"
                       style={{ fontWeight: "700", fontSize: "10.5pt", color: TEXT, textDecoration: "underline" }}>
                      {proj.name}
                    </a>
                  ) : (
                    <span style={{ fontWeight: "700", fontSize: "10.5pt" }}>{proj.name}</span>
                  )}
                  {proj.tech.length > 0 && (
                    <span style={{ fontSize: "9.5pt", fontStyle: "italic", color: MUTED, marginLeft: "6px" }}>
                      | {proj.tech.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              {proj.description && (
                <Bullet>{proj.description}</Bullet>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* ── Technical Skills ── */}
      {sections.skills.length > 0 && (
        <Section title="Technical Skills">
          {sections.skills.map((group) => (
            <div key={group.id} style={{ fontSize: "10pt", marginBottom: "3px" }}>
              {group.category !== "General" ? (
                <>
                  <span style={{ fontWeight: "700" }}>{group.category}: </span>
                  <span style={{ color: TEXT }}>{group.items.join(", ")}</span>
                </>
              ) : (
                <span style={{ color: TEXT }}>{group.items.join(", ")}</span>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{
          fontSize: "10pt",
          fontWeight: "700",
          fontVariant: "small-caps",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#000",
          whiteSpace: "nowrap",
        }}>
          {title}
        </span>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#000", marginTop: "1px" }} />
      </div>
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "6px", fontSize: "10pt", color: TEXT, lineHeight: "1.45", marginBottom: "2px", paddingLeft: "2px" }}>
      <span style={{ flexShrink: 0, marginTop: "0px" }}>—</span>
      <span>{children}</span>
    </div>
  );
}
