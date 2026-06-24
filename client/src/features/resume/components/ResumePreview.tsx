import type { ParsedSections, ResumeTemplate } from "../types/resume.types";
import { ClassicTemplate } from "./templates/ClassicTemplate";
import { ModernTemplate } from "./templates/ModernTemplate";
import { MinimalTemplate } from "./templates/MinimalTemplate";
import { ProfessionalTemplate } from "./templates/ProfessionalTemplate";

interface Props {
  sections: ParsedSections;
  template?: ResumeTemplate;
  id?: string;
}

export function ResumePreview({ sections, template = "classic", id }: Props) {
  switch (template) {
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
