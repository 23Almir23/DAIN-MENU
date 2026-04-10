/**
 * useCopilotContext — fetches the menu health snapshot from GET /api/copilot/context.
 *
 * Accepts an options object so callers can control `enabled` and `staleTime`:
 *   - CopilotPanel: { enabled: open, staleTime: 0 } — fresh data every time the panel opens
 *   - AppSidebar:   { staleTime: 60_000 }           — background refresh every 60 s for badge
 *
 * Zero AI cost — purely a DB aggregation.
 */

import { useQuery } from "@tanstack/react-query";

export interface TranslationCoverageSignal {
  langCode: string;
  translated: number;
  total: number;
  pct: number;
}

export interface CopilotContext {
  totalItems: number;
  missingDescriptions: number;
  missingPrices: number;
  needsReview: number;
  soldOut: number;
  specials: number;
  translationCoverage: TranslationCoverageSignal[];
  serviceOpen: boolean;
  credits: number;
  plan: string;
}

/**
 * Translation coverage is considered "complete" at this percentage.
 * Shared by countOpenSignals (sidebar badge) and CopilotPanel (signal cards)
 * so both surfaces agree on which languages are "not done yet".
 */
export const TRANSLATION_COMPLETE_THRESHOLD = 100;

/**
 * Count the number of distinct open signals in a CopilotContext.
 * Each non-zero / incomplete signal type increments the count by 1.
 * Used by both the sidebar badge and the panel to stay in sync.
 */
export function countOpenSignals(ctx: CopilotContext): number {
  let count = 0;
  if (ctx.missingPrices > 0) count++;
  if (ctx.needsReview > 0) count++;
  if (ctx.missingDescriptions > 0) count++;
  count += ctx.translationCoverage.filter((c) => c.pct < TRANSLATION_COMPLETE_THRESHOLD).length;
  if (ctx.soldOut > 0) count++;
  if (ctx.specials > 0) count++;
  // Service signal is suppressed when totalItems === 0 (noise reduction for empty menus)
  if (!ctx.serviceOpen && ctx.totalItems > 0) count++;
  if (ctx.credits <= 10) count++;
  return count;
}

async function fetchCopilotContext(): Promise<CopilotContext> {
  const res = await fetch("/api/copilot/context", { credentials: "include" });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { message?: string }).message ?? `${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export interface UseCopilotContextOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useCopilotContext(options: UseCopilotContextOptions = {}) {
  const { enabled = true, staleTime = 0 } = options;
  return useQuery<CopilotContext, Error>({
    queryKey: ["/api/copilot/context"],
    queryFn: fetchCopilotContext,
    enabled,
    staleTime,
    retry: (count, err) => {
      if (err.message.startsWith("401") || err.message.startsWith("404")) return false;
      return count < 2;
    },
  });
}
