/**
 * Vite middleware integration for development mode.
 * In production, Express serves the static build output instead.
 *
 * This keeps a single server process on port 5000 for both the API
 * and the frontend, eliminating any CORS complexity.
 */

import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export async function setupVite(app: Express) {
  if (process.env.NODE_ENV === "production") {
    setupStatic(app);
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);
}

function setupStatic(app: Express) {
  const distPath = path.resolve(root, "dist");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Build output not found at ${distPath}. Run 'npm run build' first.`);
  }
  app.use(express.static(distPath));
  // Express 5 requires a named wildcard — bare "*" is invalid in path-to-regexp v8.
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
