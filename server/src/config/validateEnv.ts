// ═══════════════════════════════════════════════════════════════
// Env validation — fail fast on missing CORE config, warn on optional.
//
// Imported first in index.ts (after dotenv) so the process exits with a
// single clear message instead of crashing later with an opaque error
// (e.g. `Bearer undefined`, Supabase client throwing on first query).
// ═══════════════════════════════════════════════════════════════

// Core vars — the server cannot function without these. Missing → fatal.
const REQUIRED: string[] = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "JWT_SECRET",
];

// Provider/optional vars — features degrade if missing, but the server boots.
const OPTIONAL: { key: string; feature: string }[] = [
    { key: "GROQ_API_KEY", feature: "chat / most AI features (Groq)" },
    { key: "GEMINI_API_KEY", feature: "resume edit & tailoring (Gemini)" },
    { key: "MISTRAL_API_KEY", feature: "code generation (Codestral)" },
    { key: "GOOGLE_CLIENT_ID", feature: "Google OAuth sign-in" },
    { key: "GOOGLE_CLIENT_SECRET", feature: "Google OAuth sign-in" },
];

export function validateEnv(): void {
    const missing = REQUIRED.filter(k => !process.env[k]?.trim());
    if (missing.length > 0) {
        console.error(
            `\n❌ Missing required environment variables: ${missing.join(", ")}\n` +
            `   Copy server/.env.example to server/.env and fill these in.\n`
        );
        process.exit(1);
    }

    const missingOptional = OPTIONAL.filter(o => !process.env[o.key]?.trim());
    for (const o of missingOptional) {
        console.warn(`⚠️  ${o.key} not set — ${o.feature} will be unavailable.`);
    }
}

// Run on import. Because index.ts imports this module (after dotenv) BEFORE
// the route/config imports, validation executes before modules like
// config/supabase.ts construct clients from these vars — giving a clean
// error instead of an opaque downstream crash. ESM hoists imports, so a
// plain function call placed between import statements would NOT run early
// enough; an import side-effect does.
validateEnv();
