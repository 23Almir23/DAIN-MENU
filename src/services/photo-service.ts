/**
 * Photo service — handles image upload, storage, and retrieval.
 *
 * Currently stores images as base64 data URLs in localStorage.
 * In Replit, replace with real file storage:
 *   - POST /api/photos/upload  → returns { url }
 *   - DELETE /api/photos/:id
 *
 * No other file should handle photo persistence logic directly.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export interface PhotoUploadResult {
  /** URL or data URI of the uploaded photo */
  url: string;
}

export interface PhotoValidationError {
  code: "TOO_LARGE" | "INVALID_TYPE";
  message: string;
}

/**
 * Validate a photo file before upload.
 * Returns null if valid, or an error object.
 */
export function validatePhoto(file: File): PhotoValidationError | null {
  if (!file.type.startsWith("image/")) {
    return { code: "INVALID_TYPE", message: "Please select an image file" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { code: "TOO_LARGE", message: "Image must be under 5 MB" };
  }
  return null;
}

/**
 * Upload a photo and get a URL.
 * Currently returns a base64 data URL (frontend-only).
 * In Replit: POST /api/photos/upload (multipart) → { url: "https://..." }
 */
export async function uploadPhoto(file: File): Promise<PhotoUploadResult> {
  const error = validatePhoto(file);
  if (error) throw new Error(error.message);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) resolve({ url });
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Delete a photo by URL.
 * In Replit: DELETE /api/photos/:id
 */
export async function deletePhoto(_url: string): Promise<void> {
  // No-op in frontend-only mode (localStorage cleanup happens via state)
}

export { MAX_FILE_SIZE, ACCEPTED_TYPES };
