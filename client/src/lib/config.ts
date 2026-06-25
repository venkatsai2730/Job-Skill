// Single source of truth for the backend base URL.
// Falls back to localhost for dev; warns loudly if a production build ships
// without VITE_API_URL set (which would otherwise silently point the browser
// at localhost:3001 and fail with connection-refused/CORS in prod).

const fromEnv = import.meta.env.VITE_API_URL as string | undefined;

if (!fromEnv && import.meta.env.PROD) {
  // eslint-disable-next-line no-console
  console.warn(
    "[config] VITE_API_URL is not set in this production build — " +
    "falling back to http://localhost:3001, which will not work in production. " +
    "Set VITE_API_URL at build time."
  );
}

export const API_URL = fromEnv || "http://localhost:3001";
