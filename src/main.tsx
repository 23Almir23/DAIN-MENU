import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Initialize Sentry only when DSN is present — local dev without the var works silently.
if (import.meta.env.VITE_SENTRY_DSN_FRONTEND) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN_FRONTEND });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
    <App />
  </Sentry.ErrorBoundary>
);
