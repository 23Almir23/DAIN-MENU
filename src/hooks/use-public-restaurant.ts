import { useQuery } from "@tanstack/react-query";

export interface PublicRestaurantData {
  name: string;
  cuisine: string;
  guestTheme: string;
  template?: string;
  baseLanguage: string;
  currency?: string;
  defaultLocale?: string;
  // Guest view display fields
  description?: string;
  address?: string;
  phone?: string;
  coverImage?: string;
  guestContactInfo?: string;
  city?: string;
}

async function fetchPublicRestaurant(restaurantId: string): Promise<PublicRestaurantData> {
  const res = await fetch(`/api/public/restaurant/${restaurantId}`);
  if (res.status === 404) throw new Error("404: Not found");
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export function usePublicRestaurant(restaurantId: string | null, enabled = true) {
  const query = useQuery<PublicRestaurantData, Error>({
    queryKey: ["/api/public/restaurant", restaurantId],
    queryFn: () => fetchPublicRestaurant(restaurantId!),
    enabled: enabled && !!restaurantId,
    retry: (count, err) => {
      if (err.message.startsWith("404")) return false;
      return count < 2;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    restaurant: query.data ?? null,
    isLoading: query.isLoading,
    isNotFound: query.error?.message.startsWith("404") ?? false,
    isError: query.isError,
  };
}
