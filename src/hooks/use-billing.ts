/**
 * useBilling — server-backed hook for credits, plan, and credit history.
 *
 * Fetches from GET /api/billing and exposes mutations for:
 *   useCredits(amount, action, itemName?)  — synchronous check + async deduction
 *   setPlan(planId)                        — plan change
 *
 * Derived flags:
 *   planCredits   — credit allocation for the current plan
 *   isLowCredits  — true when credits ≤ 30 (show warning, but not blocking)
 *   isOutOfCredits — true when credits <= 0 (blocking state)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { CreditTransaction, PlanId } from "@/types/menu";

export interface BillingData {
  credits: number;
  plan: PlanId;
  creditHistory: CreditTransaction[];
}

const PLAN_CREDITS: Record<PlanId, number> = {
  free: 50,
  starter: 200,
  pro: 1000,
};

const LOW_CREDITS_THRESHOLD = 30;

async function fetchBilling(): Promise<BillingData> {
  const res = await fetch("/api/billing", { credentials: "include" });
  if (res.status === 401) throw new Error("401: Unauthorized");
  if (res.status === 404) throw new Error("404: Not found");
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export function useBilling(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery<BillingData, Error>({
    queryKey: ["/api/billing"],
    queryFn: fetchBilling,
    enabled,
    retry: (count, err) => {
      if (err.message.startsWith("401") || err.message.startsWith("404")) return false;
      return count < 2;
    },
    staleTime: 1000 * 60 * 5,
  });

  const useCreditsAction = useCallback(
    (amount: number, action: string, itemName?: string): boolean => {
      const current = queryClient.getQueryData<BillingData>(["/api/billing"]);
      if (!current || current.credits < amount) return false;

      queryClient.setQueryData<BillingData>(["/api/billing"], (old) =>
        old ? { ...old, credits: Math.max(0, old.credits - amount) } : old
      );

      fetch("/api/billing/use-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount, action, itemName }),
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/billing"] }))
        .catch(() => queryClient.invalidateQueries({ queryKey: ["/api/billing"] }));

      return true;
    },
    [queryClient]
  );

  const setPlanMutation = useMutation({
    mutationFn: async (planId: PlanId) => {
      const res = await fetch("/api/billing/set-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error("Failed to update plan.");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/billing"] }),
  });

  const plan = query.data?.plan ?? "free";
  const credits = query.data?.credits ?? 50;
  const planCredits = PLAN_CREDITS[plan];

  return {
    credits,
    plan,
    planCredits,
    creditHistory: query.data?.creditHistory ?? [],
    isLoading: query.isLoading,
    isLowCredits: credits > 0 && credits <= LOW_CREDITS_THRESHOLD,
    isOutOfCredits: credits <= 0,
    useCredits: useCreditsAction,
    setPlan: setPlanMutation.mutate,
    isSettingPlan: setPlanMutation.isPending,
  };
}
