import useSWR from "swr";
import type { UnifiedMarket } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMarkets() {
  const { data, error, isLoading, mutate } = useSWR<{
    markets: UnifiedMarket[];
  }>("/api/markets", fetcher, { refreshInterval: 30000 });
  return { markets: data?.markets ?? [], error, isLoading, refresh: mutate };
}
