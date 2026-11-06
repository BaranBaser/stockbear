import { z } from "zod";

const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(25)
  .regex(/^[A-Z0-9^][A-Z0-9.^=-]*$/);
export const stockInput = z.object({ symbol: symbolSchema.default("THYAO") });
export const historyInput = stockInput.extend({
  range: z
    .enum(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"])
    .default("1mo"),
});
export const batchInput = z.object({
  limit: z.number().int().min(0).max(1000).default(0),
});

const numberArray = z.array(z.number().finite().nullable());
const chartSchema = z.object({
  meta: z.record(z.unknown()),
  timestamp: z.array(z.number().finite()).optional(),
  indicators: z
    .object({
      quote: z.array(
        z.object({
          close: numberArray,
          open: numberArray.optional(),
          high: numberArray.optional(),
          low: numberArray.optional(),
          volume: numberArray.optional(),
        }),
      ),
    })
    .optional(),
});
type YahooChart = z.infer<typeof chartSchema>;
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const optionalNumber = (value: unknown) =>
  nonnegative.safeParse(value).success ? (value as number) : 0;
const isoTime = (value: unknown) =>
  new Date(positive.parse(value) * 1000).toISOString();

export function parseQuote(value: unknown, expectedSymbol?: string) {
  const { meta } = chartSchema.parse(value);
  const symbol = z.string().min(1).parse(meta.symbol);
  if (expectedSymbol && symbol.toUpperCase() !== expectedSymbol.toUpperCase())
    throw new Error("Veri sembolü eşleşmiyor.");
  const price = positive.parse(meta.regularMarketPrice);
  const prevClose = positive.parse(
    meta.previousClose ?? meta.chartPreviousClose,
  );
  return {
    symbol,
    currency:
      typeof meta.currency === "string" && /^[A-Z]{3}$/.test(meta.currency)
        ? meta.currency
        : "—",
    name: String(meta.shortName || meta.longName || symbol),
    price,
    prevClose,
    change: price - prevClose,
    changePercent: ((price - prevClose) / prevClose) * 100,
    high: optionalNumber(meta.regularMarketDayHigh),
    low: optionalNumber(meta.regularMarketDayLow),
    volume: optionalNumber(meta.regularMarketVolume),
    high52: optionalNumber(meta.fiftyTwoWeekHigh),
    low52: optionalNumber(meta.fiftyTwoWeekLow),
    source: "Yahoo Finance" as const,
    asOf: isoTime(meta.regularMarketTime),
    fetchedAt: new Date().toISOString(),
  };
}
export type MarketQuote = ReturnType<typeof parseQuote>;
export function retainPreviousQuotes<
  T extends MarketQuote,
  B extends { stocks: T[]; unavailableSymbols: string[] },
>(current: B, previous?: { stocks: T[] }): B {
  const unavailable = new Set(current.unavailableSymbols);
  const retained =
    previous?.stocks.filter((quote) => unavailable.has(quote.symbol)) ?? [];
  return { ...current, stocks: [...current.stocks, ...retained] };
}
export type HistoryPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function parseHistory(value: unknown): HistoryPoint[] {
  // A corrupt candle must not invalidate valid neighbouring candles.
  const raw = value as {
    timestamp?: unknown[];
    indicators?: {
      quote?: {
        open?: unknown[];
        high?: unknown[];
        low?: unknown[];
        close?: unknown[];
        volume?: unknown[];
      }[];
    };
  };
  const quote = raw?.indicators?.quote?.[0];
  if (!Array.isArray(raw?.timestamp) || !quote)
    throw new Error("Geçmiş veri alınamadı.");
  const rows = new Map<number, HistoryPoint>();
  raw.timestamp.forEach((time, i) => {
    const values = [
      quote.open?.[i],
      quote.high?.[i],
      quote.low?.[i],
      quote.close?.[i],
    ];
    if (
      !positive.safeParse(time).success ||
      values.some((v) => !positive.safeParse(v).success)
    )
      return;
    const [open, high, low, close] = values as number[];
    if (
      low > Math.min(open, close) ||
      high < Math.max(open, close) ||
      low > high
    )
      return;
    rows.set(time as number, {
      date: isoTime(time),
      open,
      high,
      low,
      close,
      volume: optionalNumber(quote.volume?.[i]),
    });
  });
  if (!rows.size) throw new Error("Geçerli geçmiş veri bulunamadı.");
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

export async function collectQuotes<T extends MarketQuote>(
  symbols: string[],
  load: (symbol: string) => Promise<T>,
  concurrency = 10,
  budgetMs = 20_000,
) {
  const startedAt = Date.now();
  const stocks: T[] = [];
  const unavailableSymbols: string[] = [];
  for (let i = 0; i < symbols.length; i += concurrency) {
    if (Date.now() - startedAt >= budgetMs) {
      unavailableSymbols.push(...symbols.slice(i));
      break;
    }
    const batch = symbols.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(load));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") stocks.push(result.value);
      else unavailableSymbols.push(batch[index]);
    });
  }
  if (!stocks.length)
    throw new Error("Piyasa verisi alınamadı. Lütfen tekrar deneyin.");
  return {
    stocks,
    unavailableSymbols,
    requestedCount: symbols.length,
    source: "Yahoo Finance" as const,
  };
}

export function createYahooClient(
  fetcher: typeof fetch = fetch,
  timeoutMs = 8000,
) {
  const cache = new Map<string, { data: YahooChart; at: number }>();
  const pending = new Map<string, Promise<YahooChart>>();
  return function load(
    symbol: string,
    range = "1d",
    interval = "1d",
  ): Promise<YahooChart> {
    const key = `${symbol}:${range}:${interval}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < 60000)
      return Promise.resolve(cached.data);
    const running = pending.get(key);
    if (running) return running;
    const request = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${new URLSearchParams({ range, interval })}`;
        const response = await fetcher(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            `Veri sağlayıcısı yanıt vermedi (${response.status}).`,
          );
        const json = await response.json();
        const data = chartSchema.parse(json.chart?.result?.[0]);
        parseQuote(data, symbol);
        // Keep the process cache bounded, including arbitrary valid user symbols.
        if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
        cache.set(key, { data, at: Date.now() });
        return data;
      } finally {
        clearTimeout(timer);
      }
    })();
    pending.set(key, request);
    void request.finally(() => pending.delete(key)).catch(() => {});
    return request;
  };
}
