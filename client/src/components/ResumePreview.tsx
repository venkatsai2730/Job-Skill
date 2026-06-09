// ═══════════════════════════════════════════════════════════════
// ResumePreview — Live HTML resume renderer from ResumeData
// Replaces PDF viewer when AI edits are applied.
// Styled to look like a clean ATS-friendly resume document.
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { motion } from "framer-motion";
import type { ResumeData } from "@/lib/resumeTypes";

interface ResumePreviewProps {
    data: ResumeData;
    highlightedSection: string | null;
    zoom?: number;
}

// ── Section highlight animation ───────────────────────────────
function SectionWrapper({
    id,
    isHighlighted,
    children,
}: {
    id: string;
    isHighlighted: boolean;
    children: React.ReactNode;
}) {
    return (
        <motion.div
            id={`resume-section-${id}`}
            animate={isHighlighted ? {
                boxShadow: [
                    "0 0 0 0 rgba(34, 197, 94, 0)",
                    "0 0 0 3px rgba(34, 197, 94, 0.4)",
                    "0 0 0 3px rgba(34, 197, 94, 0.2)",
                    "0 0 0 0 rgba(34, 197, 94, 0)",
                ],
            } : {}}
            transition={{ duration: 2, ease: "easeOut" }}
            className={`rounded-lg transition-all duration-300 ${
                isHighlighted ? "bg-emerald-50/40 ring-1 ring-emerald-200" : ""
            }`}
            style={{ padding: isHighlighted ? "8px" : "0" }}
        >
            {children}
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const ResumePreview: React.FC<ResumePreviewProps> = ({
    data,
    highlightedSection,
    zoom = 1.0,
}) => {
    return (
        <div
            id="resume-preview"
            className="w-full bg-white shadow-xl rounded-lg overflow-hidden relative"
            style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                maxWidth: 720,
                margin: "0 auto",
            }}
        >
            <style>{`
                @media print {
                    /* Hide everything in the body by default */
                    body * {
                        visibility: hidden !important;
                    }
                    /* Specifically make only the resume-preview and all of its nested children visible */
                    #resume-preview, #resume-preview * {
                        visibility: visible !important;
                    }
                    /* Position the preview perfectly at the top-left of the print page with absolute width */
                    #resume-preview {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        transform: none !important;
                    }
                    /* Set a clean page margin and remove standard headers/footers */
                    @page {
                        margin: 1.5cm;
                    }
                }
            `}</style>
            <div className="px-10 py-8 space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

                {/* ── SUMMARY ── */}
                {data.summary && (
                    <SectionWrapper id="summary" isHighlighted={highlightedSection === "summary"}>
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2 border-b border-gray-200 pb-1.5">
                            Professional Summary
                        </h2>
                        <p className="text-[13px] text-gray-700 leading-relaxed">
                            {data.summary}
                        </p>
                    </SectionWrapper>
                )}

                {/* ── EXPERIENCE ── */}
                {data.experience.length > 0 && (
                    <SectionWrapper id="experience" isHighlighted={highlightedSection === "experience"}>
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 border-b border-gray-200 pb-1.5">
                            Experience
                        </h2>
                        <div className="space-y-4">
                            {data.experience.map((exp) => (
                                <div key={exp.id} className="space-y-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <div>
                                            <span className="text-[13px] font-semibold text-gray-900">{exp.title}</span>
                                            {exp.company && (
                                                <span className="text-[13px] text-gray-600"> — {exp.company}</span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-gray-500 shrink-0 italic">
                                            {exp.start_date}{exp.end_date ? ` – ${exp.end_date}` : ""}
                                        </span>
                                    </div>
                                    {exp.bullets.length > 0 && (
                                        <ul className="list-none space-y-1 ml-0">
                                            {exp.bullets.map((bullet, bi) => (
                                                <li key={bi} className="text-[12px] text-gray-700 leading-relaxed flex items-start gap-2">
                                                    <span className="text-gray-400 mt-1.5 shrink-0">•</span>
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </SectionWrapper>
                )}

                {/* ── EDUCATION ── */}
                {data.education.length > 0 && (
                    <SectionWrapper id="education" isHighlighted={highlightedSection === "education"}>
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 border-b border-gray-200 pb-1.5">
                            Education
                        </h2>
                        <div className="space-y-2.5">
                            {data.education.map((edu) => (
                                <div key={edu.id} className="flex items-baseline justify-between gap-2">
                                    <div>
                                        <span className="text-[13px] font-semibold text-gray-900">{edu.degree}</span>
                                        {edu.institution && (
                                            <span className="text-[13px] text-gray-600"> — {edu.institution}</span>
                                        )}
                                        {edu.grade && (
                                            <span className="text-[12px] text-gray-500"> | {edu.grade}</span>
                                        )}
                                    </div>
                                    {edu.year && (
                                        <span className="text-[11px] text-gray-500 shrink-0 italic">{edu.year}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </SectionWrapper>
                )}

                {/* ── SKILLS ── */}
                {data.skills.length > 0 && (
                    <SectionWrapper id="skills" isHighlighted={highlightedSection === "skills"}>
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2.5 border-b border-gray-200 pb-1.5">
                            Technical Skills
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {data.skills.map((skill, i) => (
                                <span
                                    key={i}
                                    className="text-[11px] text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200/60 font-medium"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </SectionWrapper>
                )}

                {/* ── PROJECTS ── */}
                {data.projects.length > 0 && (
                    <SectionWrapper id="projects" isHighlighted={highlightedSection === "projects"}>
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 border-b border-gray-200 pb-1.5">
                            Projects
                        </h2>
                        <div className="space-y-3">
                            {data.projects.map((proj) => (
                                <div key={proj.id} className="space-y-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-[13px] font-semibold text-gray-900">{proj.name}</span>
                                        {proj.tech_stack.length > 0 && (
                                            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                                                {proj.tech_stack.slice(0, 4).join(", ")}
                                                {proj.tech_stack.length > 4 ? ` +${proj.tech_stack.length - 4}` : ""}
                                            </span>
                                        )}
                                    </div>
                                    {proj.description && (
                                        <p className="text-[12px] text-gray-600 leading-relaxed">{proj.description}</p>
                                    )}
                                    {proj.bullets.length > 0 && (
                                        <ul className="list-none space-y-0.5 ml-0">
                                            {proj.bullets.map((bullet, bi) => (
                                                <li key={bi} className="text-[12px] text-gray-700 leading-relaxed flex items-start gap-2">
                                                    <span className="text-gray-400 mt-1.5 shrink-0">•</span>
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </SectionWrapper>
                )}

                {/* ── CERTIFICATIONS ── */}
                {data.certifications && data.certifications.length > 0 && (
                    <SectionWrapper id="certifications" isHighlighted={false}>
                        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2.5 border-b border-gray-200 pb-1.5">
                            Certifications
                        </h2>
                        <div className="space-y-1">
                            {data.certifications.map((cert, i) => (
                                <div key={i} className="text-[12px] text-gray-700">
                                    <span className="font-medium">{cert.name}</span>
                                    {cert.issuer && <span className="text-gray-500"> — {cert.issuer}</span>}
                                    {cert.year && <span className="text-gray-400 ml-1">({cert.year})</span>}
                                </div>
                            ))}
                        </div>
                    </SectionWrapper>
                )}
            </div>
        </div>
    );
};
