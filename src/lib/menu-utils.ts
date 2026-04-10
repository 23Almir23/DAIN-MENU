import type { MenuCategory, MenuItem } from "@/types/menu";
import { getAvailableLanguages } from "@/lib/i18n-utils";

/**
 * Format a price using the restaurant's currency.
 * Falls back to USD when no currency code is provided.
 */
export function formatPrice(price: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    // Unknown currency code — fall back to USD formatting
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }
}

/** Sort categories by their order field (immutable) */
export function sortCategories(categories: MenuCategory[]): MenuCategory[] {
  return categories.slice().sort((a, b) => a.order - b.order);
}

/** Group items by category, sorted by category order */
export function groupItemsByCategory(
  categories: MenuCategory[],
  items: MenuItem[],
  opts?: { onlyAvailable?: boolean }
): Array<MenuCategory & { items: MenuItem[] }> {
  return sortCategories(categories).map((cat) => ({
    ...cat,
    items: items.filter(
      (i) => i.categoryId === cat.id && (!opts?.onlyAvailable || i.isAvailable)
    ),
  }));
}

/** Centralized derived stats from app state */
export interface MenuStats {
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  popularItems: number;
  withAllergens: number;
  totalCategories: number;
  languageCount: number;
  avgPrice: number;
}

export function getMenuStats(state: { menuItems: MenuItem[]; categories: MenuCategory[] }): MenuStats {
  const items = state.menuItems;
  const available = items.filter((i) => i.isAvailable).length;
  return {
    totalItems: items.length,
    availableItems: available,
    unavailableItems: items.length - available,
    popularItems: items.filter((i) => i.isPopular).length,
    withAllergens: items.filter((i) => i.allergens.length > 0).length,
    totalCategories: state.categories.length,
    languageCount: getAvailableLanguages(items, state.categories).length,
    avgPrice:
      items.length > 0
        ? items.reduce((s, i) => s + i.price, 0) / items.length
        : 0,
  };
}
