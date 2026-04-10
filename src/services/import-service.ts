/**
 * Import service — real API calls for menu import.
 *
 * uploadMenuFile(): POST /api/import/menu-upload  (multipart, PDF/image)
 * parseMenuText():  POST /api/import/menu-text    (JSON, plain text)
 *
 * Both return a ParsedMenu draft for human review before confirm.
 *
 * uploadMenuFile uses XMLHttpRequest (not fetch) so that upload progress
 * events are available — the progress callback receives two phases:
 *   "uploading" — bytes being transferred to the server (0–100%)
 *   "parsing"   — upload complete, server is processing with Gemini
 *
 * Google Business import is deferred — functions remain as stubs
 * so existing callers compile without changes.
 */

import type { ParsedMenu } from "@/types/import";
import type { Restaurant } from "@/types/menu";

export interface GoogleBusinessResult {
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  rating: number;
  reviewCount: number;
  hours: string;
  photos: number;
  description: string;
}

/** Stub — Google Business import is deferred. */
export async function searchGoogleBusiness(
  _query: string
): Promise<GoogleBusinessResult[]> {
  return [];
}

/** Stub — Google Business import is deferred. */
export async function importGoogleBusiness(
  _result: GoogleBusinessResult
): Promise<Partial<Restaurant>> {
  return {};
}

export type UploadPhase = "uploading" | "parsing";
export type ProgressCallback = (phase: UploadPhase, percent?: number) => void;

/**
 * Upload a menu file (PDF, JPG, PNG, WEBP ≤ 20 MB) via multipart to
 * POST /api/import/menu-upload. Gemini parses it server-side.
 *
 * Uses XMLHttpRequest so real upload progress events are available.
 * onProgress is called with:
 *   ("uploading", 0..100) while bytes are being sent
 *   ("parsing")           once upload completes, while Gemini processes
 *
 * Returns a ParsedMenu draft. Throws with a user-displayable message on failure.
 */
export function uploadMenuFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParsedMenu> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/import/menu-upload");
    xhr.withCredentials = true;

    // Track upload bytes → "uploading" phase
    xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
      if (e.lengthComputable && onProgress) {
        onProgress("uploading", Math.round((e.loaded / e.total) * 100));
      }
    });

    // Upload finished on the wire → server is now parsing with Gemini
    xhr.upload.addEventListener("load", () => {
      onProgress?.("parsing");
    });

    // Response received
    xhr.addEventListener("load", () => {
      let data: unknown;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Unexpected response from server."));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            (data as { message?: string }).message ??
              "File upload failed. Please try again."
          )
        );
        return;
      }

      resolve(data as ParsedMenu);
    });

    // Network-level failure
    xhr.addEventListener("error", () => {
      reject(new Error("Network error. Please check your connection and try again."));
    });

    // Timeout (not set by default, but good to handle)
    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was cancelled."));
    });

    xhr.send(formData);
  });
}

/**
 * Parse pasted menu text via POST /api/import/menu-text.
 * Returns a ParsedMenu draft. Throws with a user-displayable message on failure.
 */
export async function parseMenuText(text: string): Promise<ParsedMenu> {
  const res = await fetch("/api/import/menu-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });

  const data = await res.json().catch(() => ({
    message: "Unexpected response from server.",
    fallback: true,
  }));

  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message ?? "Menu parsing failed. Please try again."
    );
  }

  return data as ParsedMenu;
}
