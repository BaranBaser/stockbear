import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchBistData, type StockData } from "./ai.functions";
import { retainPreviousQuotes } from "./market-feed";

const EMPTY_STOCKS: StockData[] = [];

export function useBistData(limit = 0) {
  const fetchBist = useServerFn(fetchBistData);
  const client = useQueryClient();
  const queryKey = ["bist-data", limit];
  type Batch = Awaited<ReturnType<typeof fetchBist>>;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await fetchBist({ data: { limit } });
      return retainPreviousQuotes(result, client.getQueryData<Batch>(queryKey));
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  const stocks = query.data?.stocks ?? EMPTY_STOCKS;
  return {
    ...query,
    stocks,
    unavailableSymbols: query.data?.unavailableSymbols ?? [],
    asOf: stocks.length ? stocks.map((s) => s.asOf).sort()[0] : undefined,
  };
}
