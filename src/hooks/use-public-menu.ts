import { useQuery } from "@tanstack/react-query";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface PublicMenuData {
  categories: MenuCategory[];
  menuItems: MenuItem[];
}

async function fetchPublicMenu(restaurantId: string): Promise<PublicMenuData> {
  const res = await fetch(`/api/public/menu/${restaurantId}`);
  if (res.status === 404) throw new Error("404: Not found");
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export function usePublicMenu(restaurantId: string | null, enabled = true) {
  const query = useQuery<PublicMenuData, Error>({
    queryKey: ["/api/public/menu", restaurantId],
    queryFn: () => fetchPublicMenu(restaurantId!),
    enabled: enabled && !!restaurantId,
    retry: (count, err) => {
      if (err.message.startsWith("404")) return false;
      return count < 2;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    categories: query.data?.categories ?? [],
    menuItems: query.data?.menuItems ?? [],
    isLoading: query.isLoading,
    isNotFound: query.error?.message.startsWith("404") ?? false,
    isError: query.isError,
  };
}
