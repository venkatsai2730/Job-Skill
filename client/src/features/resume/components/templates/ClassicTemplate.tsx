import type { ParsedSections } from "../../types/resume.types";

interface Props {
  sections: ParsedSections;
  id?: string;
}

export function ClassicTemplate({ sections, id }: Props) {
  return (
    <div
      id={id}
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        color: "#111111",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontSize: "11pt",
        lineHeight: "1.45",
        padding: "48px 52px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      {(sections.name || sections.email || sections.phone || sections.location) && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          {sections.name && (
            <div style={{ fontSize: "22pt", fontWeight: "bold", letterSpacing: "0.03em", marginBottom: "5px" }}>
              {sections.name}
            </div>
          )}
          <div style={{ fontSize: "9.5pt", color: "#444", display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
            {sections.phone && <span>{sections.phone}</span>}
            {sections.email && (
              <a href={`mailto:${sections.email}`} style={{ color: "#444", textDecoration: "none" }}>{sections.email}</a>
            )}
            {sections.location && <span>{sections.location}</span>}
            {sections.links?.linkedin && (
              <a href={sections.links.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "#444", textDecoration: "underline" }}>LinkedIn</a>
            )}
            {sections.links?.github && (
              <a href={sections.links.github} target="_blank" rel="noopener noreferrer" style={{ color: "#444", textDecoration: "underline" }}>GitHub</a>
            )}
            {sections.links?.portfolio && (
              <a href={sections.links.portfolio} target="_blank" rel="noopener noreferrer" style={{ color: "#444", textDecoration: "underline" }}>Portfolio</a>
            )}
          </div>
        </div>
      )}

      {sections.summary && (
        <Section title="Professional Summary">
          <p style={{ margin: 0, textAlign: "justify" }}>{sections.summary}</p>
        </Section>
      )}

      {sections.experience.length > 0 && (
        <Section title="Experience">
          {sections.experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>
                  {exp.title}{exp.company ? ` — ${exp.company}` : ""}
                </span>
                <span style={{ fontSize: "9.5pt", fontStyle: "italic", color: "#555" }}>{exp.dates}</span>
              </div>
              {exp.bullets.length > 0 && (
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                  {exp.bullets.map((b, i) => (
                    <li key={i} style={{ marginBottom: "3px", fontSize: "10.5pt" }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      )}

      {sections.education.length > 0 && (
        <Section title="Education">
          {sections.education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: "bold", fontSize: "10.5pt" }}>
                  {edu.degree}{edu.school ? ` — ${edu.school}` : ""}
                </span>
                <span style={{ fontSize: "9.5pt", fontStyle: "italic", color: "#555" }}>
                  {edu.dates}{edu.gpa ? ` · GPA ${edu.gpa}` : ""}
                </span>
              </div>
              {edu.courses.length > 0 && (
                <p style={{ margin: "3px 0 0 0", fontSize: "9.5pt", color: "#444" }}>
                  Coursework: {edu.courses.join(", ")}
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

      {sections.skills.length > 0 && (
        <Section title="Skills">
          {sections.skills.map((group) => (
            <div key={group.id} style={{ marginBottom: "5px", fontSize: "10.5pt" }}>
              <span style={{ fontWeight: "bold" }}>{group.category}: </span>
              <span style={{ color: "#222" }}>{group.items.join(", ")}</span>
            </div>
          ))}
        </Section>
      )}

      {sections.projects.length > 0 && (
        <Section title="Projects">
          {sections.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: "bold", fontSize: "10.5pt" }}>
                {proj.url ? (
                  <a href={proj.url} target="_blank" rel="noopener noreferrer" style={{ color: "#111", textDecoration: "underline" }}>{proj.name}</a>
                ) : proj.name}
                {proj.tech.length > 0 && (
                  <span style={{ fontWeight: "normal", fontStyle: "italic", fontSize: "9.5pt", color: "#555" }}>
                    {" "}— {proj.tech.join(", ")}
                  </span>
                )}
              </div>
              {proj.description && (
                <p style={{ margin: "3px 0 0 0", fontSize: "10.5pt" }}>{proj.description}</p>
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
    <div style={{ marginBottom: "16px" }}>
      <div style={{ borderBottom: "1.5px solid #111", marginBottom: "7px", paddingBottom: "2px" }}>
        <span style={{ fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
