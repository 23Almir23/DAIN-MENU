/**
 * Derived state selectors — reusable hooks for computed app state.
 *
 * Keeps computation logic out of components and centralizes
 * memoization. In Replit, some of these may move server-side
 * (e.g. readiness checks as part of a dashboard API response).
 *
 * Phase 2.1: useApp() reads replaced with useMenu() / useRestaurant().
 * Phase 3: useMenuStats() now reads from useMenu() directly — no AppContext state.
 */

import { useMemo } from "react";
import { useMenuStats } from "@/hooks/use-menu-stats";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { getAvailableLanguages, getTranslationCoverage } from "@/lib/i18n-utils";

/** Menu readiness checklist for dashboard and onboarding */
export interface ReadinessCheck {
  label: string;
  done: boolean;
  action: string; // route to navigate to
}

export interface MenuReadiness {
  checks: ReadinessCheck[];
  done: number;
  total: number;
  percentage: number;
}

export function useMenuReadiness(): MenuReadiness {
  const { menuItems } = useMenu();
  const { restaurant } = useRestaurant();
  const stats = useMenuStats();
  const availableLangs = useAvailableLanguages();

  return useMemo(() => {
    const checks: ReadinessCheck[] = [
      { label: "At least 3 menu items", done: stats.totalItems >= 3, action: "/menu" },
      {
        label: "Items have descriptions",
        done: menuItems.filter((i) => !i.description || i.description.length < 10).length === 0,
        action: "/menu",
      },
      {
        label: "Allergens tagged",
        done: menuItems.filter((i) => i.allergens.length > 0).length >= Math.ceil(stats.totalItems * 0.5),
        action: "/ai-studio",
      },
      { label: "At least 1 guest language", done: availableLangs.length > 0, action: "/ai-studio" },
      {
        label: "Restaurant profile complete",
        done: !!restaurant?.name && !!restaurant?.phone,
        action: "/settings",
      },
    ];
    const done = checks.filter((c) => c.done).length;
    return { checks, done, total: checks.length, percentage: Math.round((done / checks.length) * 100) };
  }, [stats, menuItems, availableLangs, restaurant]);
}

/** Available guest languages derived from current menu data */
export function useAvailableLanguages(): string[] {
  const { menuItems, categories } = useMenu();
  return useMemo(
    () => getAvailableLanguages(menuItems, categories),
    [menuItems, categories]
  );
}

/** Translation coverage for a specific language */
export function useTranslationCoverage(langCode: string) {
  const { menuItems } = useMenu();
  return useMemo(
    () => getTranslationCoverage(menuItems, langCode),
    [menuItems, langCode]
  );
}
