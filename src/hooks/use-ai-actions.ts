/**
 * useAIActions — shared hook for all four AI menu-improvement actions.
 *
 * Extracted from WorkspaceEnhanceSection + AIStudio so both surfaces share
 * identical execution logic, state management, and error handling.
 *
 * API:
 *   const { processing, completed, improvementMsg, setImprovementMsg, runAction }
 *     = useAIActions({ credits, spendCredits, categories, onComplete });
 *
 *   runAction(actionId, items, totalCost, label, opts?)
 *     - actionId:   "rewrite" | "translate" | "allergens" | "calories"
 *     - items:      MenuItem[] scoped by the caller
 *     - totalCost:  pre-computed credit cost (caller's responsibility)
 *     - label:      human-readable action name for toasts
 *     - opts:       { translateLang?: string } — required for "translate"
 *
 * Per-action item handling (what gets sent to the API):
 *   rewrite    → sends all `items` as-is
 *   translate  → filters to items missing a translation for opts.translateLang
 *   allergens  → applies detectAllergens client-side, patches only items that gained new tags
 *   calories   → filters to items without calories, calls AI, then patches
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { detectAllergens } from "@/data/allergens";
import { getLanguage } from "@/lib/i18n-utils";
import i18n from "@/i18n";
import type { MenuItem, MenuCategory } from "@/types/menu";

/** Canonical set of AI action identifiers shared between AIStudio and WorkspaceEnhanceSection. */
export type AIActionId = "rewrite" | "translate" | "allergens" | "calories";

// ─── Shared utilities ────────────────────────────────────────────────────────

export async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(e.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function aiErrorMessage(err: unknown, label: string): string {
  const t = i18n.t.bind(i18n);
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("not configured") ||
    msg.includes("key is invalid") ||
    msg.includes("API key") ||
    msg.includes("NO_KEY") ||
    msg.includes("INVALID_KEY")
  ) {
    return t("aiStudio.toasts.aiUnavailable");
  }
  if (msg.includes("quota") || msg.includes("QUOTA") || msg.includes("rate limit") || msg.includes("limit")) {
    return t("aiStudio.toasts.aiQuotaExceeded");
  }
  const lower = msg.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("connect") ||
    lower.includes("network") ||
    lower.includes("timeout")
  ) {
    return t("aiStudio.toasts.aiUnavailable");
  }
  return msg || t("aiStudio.toasts.actionFailed", { label });
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface RunActionOpts {
  translateLang?: string;
}

export interface UseAIActionsOptions {
  credits: number;
  spendCredits: (amount: number, action: string, itemName?: string) => boolean;
  categories: MenuCategory[];
  onComplete?: () => void;
}

export function useAIActions({ credits, spendCredits, categories, onComplete }: UseAIActionsOptions) {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<AIActionId | null>(null);
  const [completed, setCompleted] = useState<AIActionId[]>([]);
  const [improvementMsg, setImprovementMsg] = useState<string | null>(null);

  const runAction = useCallback(async (
    actionId: AIActionId,
    items: MenuItem[],
    totalCost: number,
    label: string,
    opts?: RunActionOpts,
  ) => {
    const t = i18n.t.bind(i18n);
    if (credits < totalCost) {
      toast.error(t("aiStudio.toasts.notEnoughCredits", { need: totalCost, have: credits }));
      return;
    }
    if (items.length === 0) {
      toast.info(t("aiStudio.toasts.noItemsNeeded", { label }));
      setCompleted((prev) => [...prev, actionId]);
      return;
    }

    setProcessing(actionId);
    try {
      let changedCount = 0;
      const translateLang = opts?.translateLang ?? "";

      if (actionId === "rewrite") {
        const summary: { changed: number } = await apiFetch("/api/ai/rewrite", "POST", {
          items: items.map((i) => ({ id: i.id, name: i.name, description: i.description })),
        });
        changedCount = summary.changed;

      } else if (actionId === "translate") {
        const untranslated = items.filter((i) => !i.translations[translateLang]?.name);
        if (untranslated.length > 0) {
          const summary: { changed: number } = await apiFetch("/api/ai/translate", "POST", {
            items: untranslated.map((i) => ({ id: i.id, name: i.name, description: i.description })),
            targetLang: translateLang,
            categories: categories.map((c) => ({ id: c.id, name: c.name })),
          });
          changedCount = summary.changed;
        }

      } else if (actionId === "allergens") {
        const patches = items.flatMap((item) => {
          const detected = detectAllergens(item.description);
          const merged = Array.from(new Set([...item.allergens, ...detected]));
          return merged.length > item.allergens.length
            ? [apiFetch(`/api/items/${item.id}`, "PATCH", { allergens: merged })]
            : [];
        });
        changedCount = patches.length;
        await Promise.all(patches);

      } else if (actionId === "calories") {
        const unestimated = items.filter((i) => !i.calories);
        if (unestimated.length > 0) {
          const results: { id: string; calories: number | null }[] = await apiFetch("/api/ai/calories", "POST", {
            items: unestimated.map((i) => ({ id: i.id, name: i.name, description: i.description })),
          });
          const patches = results
            .filter((r) => r.calories !== null && r.calories > 0)
            .map((r) => apiFetch(`/api/items/${r.id}`, "PATCH", { calories: r.calories }));
          changedCount = patches.length;
          await Promise.all(patches);
        }
      }

      if (changedCount > 0) {
        await queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
        spendCredits(totalCost, label, `${changedCount} items`);
        toast.success(t("aiStudio.toasts.actionComplete", { label }), {
          description: t("aiStudio.toasts.updatedItems", { count: changedCount, cost: totalCost }),
        });
        onComplete?.();
        const langName = actionId === "translate" && translateLang
          ? (getLanguage(translateLang)?.label ?? translateLang.toUpperCase())
          : null;
        const msg = langName
          ? t("aiStudio.toasts.translationAdded", { lang: langName, count: changedCount })
          : t("aiStudio.toasts.dishesImproved", { count: changedCount });
        setImprovementMsg(msg);
        setTimeout(() => setImprovementMsg(null), 8000);
      } else {
        toast.info(t("aiStudio.toasts.alreadyUpToDate", { label }), {
          description: t("aiStudio.toasts.noCreditsCharged"),
        });
      }

      setCompleted((prev) => [...prev, actionId]);
    } catch (err) {
      toast.error(aiErrorMessage(err, label));
    } finally {
      setProcessing(null);
    }
  }, [credits, spendCredits, categories, onComplete, queryClient]);

  return { processing, completed, setCompleted, improvementMsg, setImprovementMsg, runAction };
}
