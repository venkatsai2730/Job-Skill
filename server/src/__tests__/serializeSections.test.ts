import { describe, it, expect, beforeAll } from "vitest";

// resume.ts pulls in config/supabase (createClient at import). Set dummy env
// before importing so the client constructs without throwing in the test env.
let serializeSectionsToText: (s: any) => string;
let computeAdvancedATS: (s: any, raw: string, u?: string, o?: any) => any;

beforeAll(async () => {
  process.env.SUPABASE_URL ||= "http://localhost";
  process.env.SUPABASE_SERVICE_KEY ||= "test-key";
  process.env.JWT_SECRET ||= "test-secret";
  ({ serializeSectionsToText } = await import("../routes/resume.js"));
  ({ computeAdvancedATS } = await import("../lib/advanced-scorer.js"));
});

const baseSections = () => ({
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "+1 555 1234567",
  location: "Hyderabad, India",
  summary: "Data engineer with hands-on ETL and warehousing experience.",
  experience: [
    { title: "Data Engineer", company: "Acme", dates: "2023 – Present", bullets: ["Worked on data stuff"] },
  ],
  education: [{ degree: "B.Tech IT", school: "XYZ University", dates: "2024", gpa: "8.0", courses: [] }],
  skills: [{ category: "Languages", items: ["Python", "SQL"] }],
  projects: [{ name: "ETL Tool", description: "Built an ETL tool", tech: ["Airflow"] }],
  certifications: [{ text: "AWS Certified Data Engineer" }],
  links: { linkedin: "https://linkedin.com/in/jane", github: "https://github.com/jane", medium: "https://medium.com/@jane" },
});

describe("serializeSectionsToText", () => {
  it("includes contact, links, skills, bullets and certifications", () => {
    const text = serializeSectionsToText(baseSections());
    expect(text).toContain("jane@example.com");
    expect(text).toContain("medium.com");
    expect(text).toContain("Python, SQL");
    expect(text).toContain("Worked on data stuff");
    expect(text).toContain("AWS Certified Data Engineer");
    // Section headers the scorer's regexes look for
    expect(text).toMatch(/PROFESSIONAL EXPERIENCE/i);
    expect(text).toMatch(/TECHNICAL SKILLS/i);
  });

  it("an improved bullet scores >= a weak one (regression guard)", () => {
    const weak = baseSections();
    const improved = baseSections();
    improved.experience[0].bullets = [
      "Engineered ETL pipelines processing 2M records/day, cutting report latency by 35%",
    ];
    const weakScore = computeAdvancedATS(weak, serializeSectionsToText(weak)).score;
    const improvedScore = computeAdvancedATS(improved, serializeSectionsToText(improved)).score;
    expect(improvedScore).toBeGreaterThanOrEqual(weakScore);
  });
});
