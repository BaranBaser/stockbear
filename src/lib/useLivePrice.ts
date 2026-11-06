import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchSingleStock } from "@/lib/ai.functions";

export function useLivePrice(symbol: string) {
  const fetchSingle = useServerFn(fetchSingleStock);
  const query = useQuery({
    queryKey: ["live-price", symbol],
    queryFn: () => fetchSingle({ data: { symbol } }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  return {
    ...query,
    price: query.data?.price ?? 0,
    changePercent: query.data?.changePercent ?? 0,
    volume: query.data?.volume ?? 0,
    high: query.data?.high ?? 0,
    low: query.data?.low ?? 0,
    hasData: query.data !== undefined,
    asOf: query.data?.asOf,
    source: query.data?.source,
  };
}
