import type { ParsedSections, ResumeTemplate, StyleProfile } from "../types/resume.types";
import { ClassicTemplate } from "./templates/ClassicTemplate";
import { ModernTemplate } from "./templates/ModernTemplate";
import { MinimalTemplate } from "./templates/MinimalTemplate";
import { ProfessionalTemplate } from "./templates/ProfessionalTemplate";
import { FaithfulTemplate } from "./templates/FaithfulTemplate";

interface Props {
  sections: ParsedSections;
  template?: ResumeTemplate;
  id?: string;
  /** Original-PDF style fingerprint; used by the "faithful" template. */
  styleProfile?: StyleProfile;
}

export function ResumePreview({ sections, template = "classic", id, styleProfile }: Props) {
  switch (template) {
    case "faithful":
      return <FaithfulTemplate sections={sections} style={styleProfile} id={id} />;
    case "modern":
      return <ModernTemplate sections={sections} id={id} />;
    case "minimal":
      return <MinimalTemplate sections={sections} id={id} />;
    case "professional":
      return <ProfessionalTemplate sections={sections} id={id} />;
    default:
      return <ClassicTemplate sections={sections} id={id} />;
  }
}
