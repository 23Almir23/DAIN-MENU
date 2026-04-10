/**
 * useMenuStats — derived stats from the server-backed menu query.
 *
 * Computes totals (items, categories, allergens, languages, avg price)
 * from the shared ["/api/menu"] TanStack Query cache via useMenu().
 * Zero AppContext dependency — pure selector over server-backed data.
 *
 * Used by: Dashboard, AIStudio, Billing, QRCodes, use-selectors.
 */

import { useMemo } from "react";
import { getMenuStats, type MenuStats } from "@/lib/menu-utils";
import { useMenu } from "@/hooks/use-menu";

export function useMenuStats(): MenuStats {
  const { menuItems, categories } = useMenu();
  return useMemo(
    () => getMenuStats({ menuItems, categories }),
    [menuItems, categories],
  );
}
