import type { ParsedSections } from "../../types/resume.types";

interface Props {
  sections: ParsedSections;
  id?: string;
}

export function MinimalTemplate({ sections, id }: Props) {
  return (
    <div
      id={id}
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        color: "#1a1a1a",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        fontSize: "10pt",
        lineHeight: "1.6",
        padding: "56px 64px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      {sections.name && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "24pt", fontWeight: "300", letterSpacing: "-0.02em", color: "#0a0a0a", marginBottom: "6px" }}>
            {sections.name}
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "9.5pt", color: "#555" }}>
            {sections.phone && <span>{sections.phone}</span>}
            {sections.email && (
              <a href={`mailto:${sections.email}`} style={{ color: "#555", textDecoration: "none" }}>{sections.email}</a>
            )}
            {sections.location && <span>{sections.location}</span>}
            {sections.links?.linkedin && (
              <a href={sections.links.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "#555", textDecoration: "underline" }}>LinkedIn</a>
            )}
            {sections.links?.github && (
              <a href={sections.links.github} target="_blank" rel="noopener noreferrer" style={{ color: "#555", textDecoration: "underline" }}>GitHub</a>
            )}
            {sections.links?.portfolio && (
              <a href={sections.links.portfolio} target="_blank" rel="noopener noreferrer" style={{ color: "#555", textDecoration: "underline" }}>Portfolio</a>
            )}
          </div>
        </div>
      )}

      {/* Thin divider */}
      <div style={{ height: "1px", backgroundColor: "#e0e0e0", marginBottom: "24px" }} />

      {sections.summary && (
        <MinSection title="Summary">
          <p style={{ margin: 0, color: "#333", maxWidth: "600px" }}>{sections.summary}</p>
        </MinSection>
      )}

      {sections.experience.length > 0 && (
        <MinSection title="Experience">
          {sections.experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
                <span style={{ fontWeight: "600", fontSize: "10.5pt" }}>
                  {exp.title}
                  {exp.company && <span style={{ fontWeight: "400", color: "#555" }}> · {exp.company}</span>}
                </span>
                {exp.dates && (
                  <span style={{ fontSize: "9pt", color: "#888", whiteSpace: "nowrap" }}>{exp.dates}</span>
                )}
              </div>
              {exp.bullets.length > 0 && (
                <ul style={{ margin: "5px 0 0 0", paddingLeft: "18px", color: "#333" }}>
                  {exp.bullets.map((b, i) => (
                    <li key={i} style={{ marginBottom: "2px" }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </MinSection>
      )}

      {sections.education.length > 0 && (
        <MinSection title="Education">
          {sections.education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: "600" }}>
                  {edu.degree}
                  {edu.school && <span style={{ fontWeight: "400", color: "#555" }}> · {edu.school}</span>}
                  {edu.gpa && <span style={{ fontWeight: "400", color: "#888" }}> · {edu.gpa} GPA</span>}
                </span>
                {edu.dates && <span style={{ fontSize: "9pt", color: "#888" }}>{edu.dates}</span>}
              </div>
              {edu.courses.length > 0 && (
                <p style={{ margin: "2px 0 0 0", fontSize: "9pt", color: "#666" }}>
                  {edu.courses.join(", ")}
                </p>
              )}
            </div>
          ))}
        </MinSection>
      )}

      {sections.skills.length > 0 && (
        <MinSection title="Skills">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px" }}>
            {sections.skills.map((group) => (
              <div key={group.id}>
                {group.category !== "General" && (
                  <span style={{ fontWeight: "600", color: "#333" }}>{group.category}: </span>
                )}
                <span style={{ color: "#555" }}>{group.items.join(", ")}</span>
              </div>
            ))}
          </div>
        </MinSection>
      )}

      {sections.projects.length > 0 && (
        <MinSection title="Projects">
          {sections.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: "12px" }}>
              {proj.url ? (
                <a href={proj.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: "600", color: "#1a1a1a", textDecoration: "underline" }}>{proj.name}</a>
              ) : (
                <span style={{ fontWeight: "600" }}>{proj.name}</span>
              )}
              {proj.tech.length > 0 && (
                <span style={{ color: "#888", fontSize: "9pt" }}> — {proj.tech.join(", ")}</span>
              )}
              {proj.description && (
                <p style={{ margin: "2px 0 0 0", color: "#333" }}>{proj.description}</p>
              )}
            </div>
          ))}
        </MinSection>
      )}
    </div>
  );
}

function MinSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "22px" }}>
      <div style={{ fontSize: "8.5pt", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "#888", marginBottom: "10px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
