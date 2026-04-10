/**
 * useMenu — primary data hook for categories and menu items.
 *
 * Single GET /api/menu fetch, shared query key so both
 * useCategories and useMenuItems hit the same cache entry.
 *
 * Used by:
 *   - MenuBuilder     → reads categories and items for display
 *   - Dashboard, AIStudio, Billing, QRCodes, GuestPreview → read-only consumers
 *
 * After any mutation, call:
 *   queryClient.invalidateQueries({ queryKey: ['/api/menu'] })
 * …and the hook will re-fetch and all subscribers update together.
 *
 * Translation note:
 *   Translations are hydrated as {} for Phase 1.4.
 *   The AI Studio (Phase 2) will extend item_translations and
 *   category_translations rows and the GET /api/menu response
 *   will include them then.
 */

import { useQuery } from "@tanstack/react-query";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface MenuData {
  categories: MenuCategory[];
  menuItems: MenuItem[];
}

async function fetchMenu(): Promise<MenuData> {
  const res = await fetch("/api/menu", { credentials: "include" });
  if (res.status === 401) throw new Error("401: Unauthorized");
  if (res.status === 404) throw new Error("404: Not found");
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

function useMenuQuery(enabled = true) {
  return useQuery<MenuData, Error>({
    queryKey: ["/api/menu"],
    queryFn: fetchMenu,
    enabled,
    retry: (count, err) => {
      if (err.message.startsWith("401") || err.message.startsWith("404")) return false;
      return count < 2;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useMenu(enabled = true) {
  const query = useMenuQuery(enabled);
  return {
    categories: query.data?.categories ?? [],
    menuItems: query.data?.menuItems ?? [],
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  };
}

/** Thin selector — categories only */
export function useCategories(enabled = true) {
  const query = useMenuQuery(enabled);
  return {
    categories: query.data?.categories ?? [],
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
  };
}

/** Thin selector — items only */
export function useMenuItems(enabled = true) {
  const query = useMenuQuery(enabled);
  return {
    menuItems: query.data?.menuItems ?? [],
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
  };
}
