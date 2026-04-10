/**
 * useServiceSession — loads the current open service session for the restaurant.
 *
 * Returns the open session or null. Polling interval: 60s so the "In service since"
 * timestamp stays reasonably fresh without hammering the server.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ServiceSession {
  id: string;
  restaurantId: string;
  startedAt: string;
  endedAt: string | null;
  clearedItemsSnapshot: string | null;
}

/** Item ID arrays passed to start/end. The server clears only the specified items. */
export interface SessionClearOptions {
  soldOutItemIds?: string[];
  specialItemIds?: string[];
}

async function fetchCurrentSession(): Promise<ServiceSession | null> {
  const res = await fetch("/api/service/current", { credentials: "include" });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function useServiceSession() {
  const queryClient = useQueryClient();

  const query = useQuery<ServiceSession | null>({
    queryKey: ["/api/service/current"],
    queryFn: fetchCurrentSession,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: (count, err) => {
      if (err.message.startsWith("401")) return false;
      return count < 2;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/service/current"] });
    queryClient.invalidateQueries({ queryKey: ["/api/menu"] });
  };

  const startMutation = useMutation({
    mutationFn: (opts: SessionClearOptions) =>
      apiFetch("/api/service/start", "POST", {
        soldOutItemIds: opts.soldOutItemIds ?? [],
        specialItemIds: opts.specialItemIds ?? [],
      }),
    onSuccess: invalidate,
  });

  const endMutation = useMutation({
    mutationFn: (opts: SessionClearOptions) =>
      apiFetch("/api/service/end", "POST", {
        soldOutItemIds: opts.soldOutItemIds ?? [],
        specialItemIds: opts.specialItemIds ?? [],
      }),
    onSuccess: invalidate,
  });

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    start: startMutation.mutate,
    isStarting: startMutation.isPending,
    end: endMutation.mutate,
    isEnding: endMutation.isPending,
  };
}
