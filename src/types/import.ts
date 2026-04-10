/**
 * Shared types for the menu import flow.
 * Mirror of server/gemini.ts output types — kept in sync manually.
 */

export interface ParsedCategory {
  name: string;
}

export interface ParsedItem {
  name: string;
  description: string;
  price: number;
  categoryName: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface ParsedMenu {
  categories: ParsedCategory[];
  items: ParsedItem[];
  warnings: string[];
  partial: boolean;
}

export interface ImportConfirmResult {
  categoriesCreated: number;
  itemsCreated: number;
}
