/**
 * Express server entry point.
 *
 * Runs on port 5000 — the Replit webview port.
 * In development: serves the API and proxies to Vite (SPA + HMR).
 * In production:  serves the API and the built static frontend.
 *
 * Auth is set up BEFORE all other routes (required by passport/session).
 */

import express from "express";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerRoutes } from "./routes";
import { setupVite } from "./vite";
// Dynamic import keeps @sentry/node out of the module graph entirely when the DSN
// is absent. @sentry/node v10 registers OpenTelemetry instrumentation at load time
// (before Sentry.init is called), which can conflict with Replit's process
// environment. Only loading it when the DSN is set avoids that entirely.
let Sentry: typeof import("@sentry/node") | null = null;
if (process.env.SENTRY_DSN_BACKEND) {
  Sentry = await import("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN_BACKEND });
}

const app = express();
const PORT = 5000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Auth MUST be wired before any other routes
await setupAuth(app);
registerAuthRoutes(app);

registerRoutes(app);

// Sentry error handler must be registered AFTER all routes.
if (Sentry) {
  Sentry.setupExpressErrorHandler(app);
}

// Operational note: GEMINI_API_KEY is validated lazily at request time — the server
// boots without it but /api/import/menu-text and /api/import/menu-parse return a
// typed 503 NO_KEY response so the rest of the app keeps working while the key
// is being provisioned. Change this to a throw if strict fail-fast boot is needed.
if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "[MenuAI] WARNING: GEMINI_API_KEY is not set. " +
    "The /api/import/menu-text and /api/import/menu-parse endpoints will return a " +
    "503 NO_KEY error until this secret is configured."
  );
}

await setupVite(app);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
