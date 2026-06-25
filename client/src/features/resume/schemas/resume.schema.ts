import { z } from "zod";

export const ExperienceEntrySchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  company: z.string().default(""),
  dates: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const EducationEntrySchema = z.object({
  id: z.string().default(""),
  degree: z.string().default(""),
  school: z.string().default(""),
  dates: z.string().default(""),
  gpa: z.string().default(""),
  courses: z.array(z.string()).default([]),
});

export const SkillGroupSchema = z.object({
  id: z.string().default(""),
  category: z.string().default("General"),
  items: z.array(z.string()).default([]),
});

export const ProjectEntrySchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  description: z.string().default(""),
  tech: z.array(z.string()).default([]),
  url: z.string().optional(),
});

export const CertificationEntrySchema = z.object({
  id: z.string().default(""),
  text: z.string().default(""),
});

export const ParsedSectionsSchema = z.object({
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  summary: z.string().default(""),
  experience: z.array(ExperienceEntrySchema).default([]),
  education: z.array(EducationEntrySchema).default([]),
  skills: z.array(SkillGroupSchema).default([]),
  projects: z.array(ProjectEntrySchema).default([]),
  certifications: z.array(CertificationEntrySchema).default([]),
  links: z.object({
    linkedin: z.string().optional(),
    github: z.string().optional(),
    portfolio: z.string().optional(),
    medium: z.string().optional(),
  }).optional(),
});

export const PatchOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("remove"), path: z.string() }),
]);

export const ResumePatchSchema = z.object({
  patches: z.array(PatchOperationSchema),
  summary: z.string(),
});

export const ATSResultSchema = z.object({
  score: z.number(),
  label: z.string(),
  issues: z.array(z.object({ type: z.enum(["warning", "success"]), text: z.string() })),
  keywords: z.object({
    found: z.array(z.string()),
    missing: z.array(z.string()),
    total: z.number(),
    matched: z.number(),
  }),
});

export const JDMatchResultSchema = z.object({
  score: z.number(),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export type JDMatchResult = z.infer<typeof JDMatchResultSchema>;
