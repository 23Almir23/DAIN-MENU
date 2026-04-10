/**
 * Menu service — shared constants for AI credit costs.
 *
 * AI_CREDIT_COSTS is the single source of truth for per-item credit
 * charges so Billing.tsx and AIStudio.tsx always agree.
 */

import type { AIActionType } from "@/types/menu";

/**
 * Credit cost per item for each AI action.
 * Centralized here so Billing, AIStudio, and future API all agree.
 */
export const AI_CREDIT_COSTS: Record<AIActionType, number> = {
  rewrite: 2,
  translate: 3,
  allergens: 1,
  calories: 1,
};
