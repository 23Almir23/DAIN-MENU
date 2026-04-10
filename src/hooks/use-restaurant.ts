/**
 * useRestaurant — primary data hook for restaurant data.
 *
 * Fetches from GET /api/restaurant (the server, not localStorage).
 * Returns the restaurant in the frontend shape (socialLinks parsed, etc.).
 *
 * Used by:
 *   - Settings.tsx    → initializes the edit form and tracks hasChanges
 *   - Dashboard, GuestPreview, AppSidebar → read restaurant name / branding
 *
 * 404 handling: the hook signals `isNotFound = true`. ProtectedRoute
 * acts on this by redirecting to /setup so the user creates a restaurant.
 *
 * socialLinks note: stored as JSON text in the DB; deserialized here
 * so the rest of the app always gets the typed SocialLink[] shape.
 */

import { useQuery } from "@tanstack/react-query";
import type { Restaurant } from "@/types/menu";

export type ServerRestaurant = Restaurant & { id: string; createdAt?: string; updatedAt?: string };

async function fetchRestaurant(): Promise<ServerRestaurant> {
  const res = await fetch("/api/restaurant", { credentials: "include" });

  if (res.status === 401) throw new Error("401: Unauthorized");
  if (res.status === 404) throw new Error("404: Not found");
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);

  const data = await res.json();

  // Deserialize socialLinks — stored as JSON text on the server
  if (typeof data.socialLinks === "string" && data.socialLinks) {
    try { data.socialLinks = JSON.parse(data.socialLinks); } catch { data.socialLinks = []; }
  } else if (!data.socialLinks) {
    data.socialLinks = [];
  }

  // Normalise array fields that may be null from the DB
  if (!data.serviceTypes) data.serviceTypes = [];
  if (!data.supportedLanguages) data.supportedLanguages = ["en"];

  return data;
}

export function useRestaurant(enabled = true) {
  const query = useQuery<ServerRestaurant, Error>({
    queryKey: ["/api/restaurant"],
    queryFn: fetchRestaurant,
    enabled,
    retry: (count, err) => {
      // Don't retry on 401 or 404 — those are logic states, not transient errors
      if (err.message.startsWith("401") || err.message.startsWith("404")) return false;
      return count < 2;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isNotFound = query.error?.message.startsWith("404") ?? false;

  return {
    restaurant: query.data ?? null,
    isLoading: query.isLoading,
    isNotFound,
    error: query.error,
    refetch: query.refetch,
  };
}
