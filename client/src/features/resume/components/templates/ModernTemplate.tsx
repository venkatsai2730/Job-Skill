import type { ParsedSections } from "../../types/resume.types";

interface Props {
  sections: ParsedSections;
  id?: string;
}

const ACCENT = "#1e40af";
const SIDEBAR_BG = "#1e293b";
const SIDEBAR_TEXT = "#e2e8f0";
const SIDEBAR_MUTED = "#94a3b8";

export function ModernTemplate({ sections, id }: Props) {
  return (
    <div
      id={id}
      style={{
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: "10pt",
        lineHeight: "1.5",
        display: "flex",
        boxSizing: "border-box",
      }}
    >
      {/* ── Left Sidebar ── */}
      <div
        style={{
          width: "230px",
          minHeight: "1123px",
          backgroundColor: SIDEBAR_BG,
          color: SIDEBAR_TEXT,
          padding: "36px 22px",
          flexShrink: 0,
        }}
      >
        {sections.name && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "17pt", fontWeight: "700", color: "#ffffff", lineHeight: "1.2", marginBottom: "4px" }}>
              {sections.name}
            </div>
            <div style={{ width: "32px", height: "3px", backgroundColor: ACCENT, borderRadius: "2px" }} />
          </div>
        )}

        {/* Contact */}
        {(sections.email || sections.phone || sections.location) && (
          <SideSection title="Contact">
            {sections.email && <SideItem>{sections.email}</SideItem>}
            {sections.phone && <SideItem>{sections.phone}</SideItem>}
            {sections.location && <SideItem>{sections.location}</SideItem>}
          </SideSection>
        )}

        {/* Skills */}
        {sections.skills.length > 0 && (
          <SideSection title="Skills">
            {sections.skills.map((group) => (
              <div key={group.id} style={{ marginBottom: "8px" }}>
                {group.category !== "General" && (
                  <div style={{ fontSize: "8.5pt", fontWeight: "600", color: SIDEBAR_MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>
                    {group.category}
                  </div>
                )}
                <div style={{ fontSize: "9pt", color: SIDEBAR_TEXT, lineHeight: "1.6" }}>
                  {group.items.join(" · ")}
                </div>
              </div>
            ))}
          </SideSection>
        )}

        {/* Summary in sidebar */}
        {sections.summary && (
          <SideSection title="Profile">
            <p style={{ fontSize: "9pt", color: SIDEBAR_TEXT, margin: 0, lineHeight: "1.55" }}>
              {sections.summary}
            </p>
          </SideSection>
        )}
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, padding: "36px 32px" }}>

        {sections.experience.length > 0 && (
          <MainSection title="Experience" accent={ACCENT}>
            {sections.experience.map((exp) => (
              <div key={exp.id} style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "10.5pt", color: "#111" }}>{exp.title}</div>
                    {exp.company && (
                      <div style={{ fontSize: "9.5pt", color: ACCENT, fontWeight: "600" }}>{exp.company}</div>
                    )}
                  </div>
                  {exp.dates && (
                    <div style={{ fontSize: "8.5pt", color: "#666", whiteSpace: "nowrap", marginLeft: "12px", marginTop: "2px" }}>
                      {exp.dates}
                    </div>
                  )}
                </div>
                {exp.bullets.length > 0 && (
                  <ul style={{ margin: "5px 0 0 0", paddingLeft: "14px" }}>
                    {exp.bullets.map((b, i) => (
                      <li key={i} style={{ marginBottom: "3px", fontSize: "9.5pt", color: "#222" }}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </MainSection>
        )}

        {sections.education.length > 0 && (
          <MainSection title="Education" accent={ACCENT}>
            {sections.education.map((edu) => (
              <div key={edu.id} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "10.5pt", color: "#111" }}>{edu.degree}</div>
                    {edu.school && (
                      <div style={{ fontSize: "9.5pt", color: ACCENT, fontWeight: "600" }}>{edu.school}</div>
                    )}
                    {edu.gpa && (
                      <div style={{ fontSize: "9pt", color: "#555" }}>GPA: {edu.gpa}</div>
                    )}
                  </div>
                  {edu.dates && (
                    <div style={{ fontSize: "8.5pt", color: "#666", whiteSpace: "nowrap", marginLeft: "12px" }}>
                      {edu.dates}
                    </div>
                  )}
                </div>
                {edu.courses.length > 0 && (
                  <p style={{ margin: "3px 0 0 0", fontSize: "9pt", color: "#444" }}>
                    Coursework: {edu.courses.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </MainSection>
        )}

        {sections.projects.length > 0 && (
          <MainSection title="Projects" accent={ACCENT}>
            {sections.projects.map((proj) => (
              <div key={proj.id} style={{ marginBottom: "12px" }}>
                <div style={{ fontWeight: "700", fontSize: "10.5pt", color: "#111" }}>
                  {proj.name}
                  {proj.tech.length > 0 && (
                    <span style={{ fontWeight: "400", fontSize: "9pt", color: "#555", marginLeft: "8px" }}>
                      [{proj.tech.join(", ")}]
                    </span>
                  )}
                </div>
                {proj.description && (
                  <p style={{ margin: "3px 0 0 0", fontSize: "9.5pt", color: "#333" }}>{proj.description}</p>
                )}
              </div>
            ))}
          </MainSection>
        )}
      </div>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "22px" }}>
      <div style={{ fontSize: "8pt", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#60a5fa", marginBottom: "8px", paddingBottom: "4px", borderBottom: "1px solid #334155" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SideItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "9pt", color: "#cbd5e1", marginBottom: "4px", lineHeight: "1.4" }}>
      {children}
    </div>
  );
}

function MainSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <div style={{ width: "3px", height: "16px", backgroundColor: accent, borderRadius: "2px", flexShrink: 0 }} />
        <span style={{ fontSize: "11pt", fontWeight: "700", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
