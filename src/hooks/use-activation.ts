/**
 * useActivation — derives the operator's onboarding activation state.
 *
 * Three milestones:
 *   1. nameSet         — restaurant.name is a non-empty string
 *   2. hasItems        — at least one menu item exists in the DB
 *   3. hasOpenedPreview — operator has visited Guest Preview (localStorage flag)
 *
 * Additionally surfaces:
 *   hasRunAI — any item has at least one translation (AI Studio has been used)
 *   allComplete — all three milestones done
 *   isLoading — any underlying query is still loading
 */

import { useRestaurant } from "@/hooks/use-restaurant";
import { useMenu } from "@/hooks/use-menu";

export function useActivation() {
  const { restaurant, isLoading: restaurantLoading } = useRestaurant();
  const { menuItems, isLoading: menuLoading } = useMenu();

  const nameSet = !restaurantLoading && Boolean(restaurant?.name?.trim());
  const hasItems = !menuLoading && menuItems.length > 0;
  const hasOpenedPreview =
    typeof window !== "undefined" &&
    localStorage.getItem("menuai_preview_opened") === "1";
  const hasRunAI =
    !menuLoading &&
    menuItems.some((i) => Object.keys(i.translations || {}).length > 0);

  const isLoading = restaurantLoading || menuLoading;
  const allComplete = nameSet && hasItems && hasOpenedPreview;

  return { nameSet, hasItems, hasOpenedPreview, hasRunAI, allComplete, isLoading };
}
