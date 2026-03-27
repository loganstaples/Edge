import useSWR from "swr";
import type { Article } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useNews() {
  const { data, error, isLoading, mutate } = useSWR<{ articles: Article[] }>(
    "/api/news",
    fetcher,
    { refreshInterval: 15000 }
  );
  return { articles: data?.articles ?? [], error, isLoading, refresh: mutate };
}
