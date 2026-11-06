import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createYahooClient,
  parseQuote,
  parseHistory,
  collectQuotes,
  retainPreviousQuotes,
  stockInput,
  historyInput,
  batchInput,
} from "../market-feed";

const chart = (symbol = "THYAO.IS") => ({
  meta: {
    symbol,
    regularMarketPrice: 100,
    previousClose: 100,
    chartPreviousClose: 90,
    regularMarketTime: 1780000000,
    regularMarketVolume: 0,
  },
  timestamp: [1779900000, 1780000000],
  indicators: {
    quote: [
      {
        open: [99, 100],
        high: [102, 104],
        low: [98, 99],
        close: [100, 103],
        volume: [0, 250],
      },
    ],
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe("market feed", () => {
  it("preserves the provider currency and never labels unknown currencies as TRY", () => {
    const usd = {
      ...chart("AAPL"),
      meta: { ...chart("AAPL").meta, currency: "USD" },
    };
    expect(parseQuote(usd, "AAPL").currency).toBe("USD");
    expect(parseQuote(chart(), "THYAO.IS").currency).toBe("—");
  });
  it("stops a slow market scan within its request budget and marks unqueried symbols unavailable", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async (symbol: string) => {
      await vi.advanceTimersByTimeAsync(2);
      return { ...parseQuote(chart(), "THYAO.IS"), symbol };
    });
    const result = await collectQuotes(["A", "B", "C"], load, 1, 1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.stocks.map((q) => q.symbol)).toEqual(["A"]);
    expect(result.unavailableSymbols).toEqual(["B", "C"]);
    expect(result.requestedCount).toBe(3);
  });
  it("keeps the last successful quote and original timestamp during partial refresh", () => {
    const old = { ...parseQuote(chart(), "THYAO.IS"), symbol: "THYAO" };
    const next = { ...old, symbol: "AKBNK", price: 60 };
    const result = retainPreviousQuotes(
      { stocks: [next], unavailableSymbols: ["THYAO"] },
      { stocks: [old] },
    );
    expect(result.stocks).toEqual([next, old]);
    expect(result.stocks[1].asOf).toBe(old.asOf);
    expect(result.unavailableSymbols).toEqual(["THYAO"]);
    expect(
      retainPreviousQuotes(
        { stocks: [next], unavailableSymbols: [] },
        { stocks: [old] },
      ).stocks,
    ).toEqual([next]);
  });
  it("preserves zero changes and volume, and the provider timestamp", () => {
    const quote = parseQuote(chart(), "THYAO.IS");
    expect(quote.price).toBe(100);
    expect(quote.changePercent).toBe(0);
    expect(quote.volume).toBe(0);
    expect(quote.asOf).toBe(new Date(1780000000 * 1000).toISOString());
    expect(quote.source).toBe("Yahoo Finance");
  });

  it("rejects mismatched symbols, invalid prices and missing timestamps", () => {
    expect(() => parseQuote(chart("AKBNK.IS"), "THYAO.IS")).toThrow();
    for (const price of [0, -1, NaN, Infinity, "100", null]) {
      expect(() =>
        parseQuote(
          { ...chart(), meta: { ...chart().meta, regularMarketPrice: price } },
          "THYAO.IS",
        ),
      ).toThrow();
    }
    expect(() =>
      parseQuote(
        { meta: { symbol: "THYAO.IS", regularMarketPrice: 100 } },
        "THYAO.IS",
      ),
    ).toThrow();
  });

  it("does not backfill missing candles with future prices or fabricate OHLC", () => {
    const value = chart();
    value.indicators.quote[0].close[0] = NaN;
    expect(parseHistory(value)).toEqual([
      {
        date: new Date(1780000000 * 1000).toISOString(),
        open: 100,
        high: 104,
        low: 99,
        close: 103,
        volume: 250,
      },
    ]);
    value.indicators.quote[0].high[1] = 90;
    expect(() => parseHistory(value)).toThrow();
  });

  it("reports partial failures and never returns fake zero quotes", async () => {
    const result = await collectQuotes(
      ["THYAO", "BAD"],
      async (symbol) => {
        if (symbol === "BAD") throw new Error("offline");
        return { ...parseQuote(chart(), "THYAO.IS"), symbol };
      },
      1,
    );
    expect(result.stocks.map((q) => q.symbol)).toEqual(["THYAO"]);
    expect(result.unavailableSymbols).toEqual(["BAD"]);
    expect(result.requestedCount).toBe(2);
    await expect(
      collectQuotes(["BAD"], async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow();
  });

  it("limits concurrency and retains requested order", async () => {
    let active = 0;
    let peak = 0;
    const result = await collectQuotes(
      ["A", "B", "C", "D"],
      async (symbol) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return { ...parseQuote(chart(), "THYAO.IS"), symbol };
      },
      2,
    );
    expect(peak).toBe(2);
    expect(result.stocks.map((q) => q.symbol)).toEqual(["A", "B", "C", "D"]);
  });

  it("deduplicates concurrent requests and caches successful responses only", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ chart: { result: [chart()] } })),
    );
    const client = createYahooClient(fetcher);
    await Promise.all([client("THYAO.IS"), client("THYAO.IS")]);
    await client("THYAO.IS");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const failing = vi.fn(
      async () => new Response("rate limited", { status: 429 }),
    );
    const failedClient = createYahooClient(failing);
    await expect(failedClient("THYAO.IS")).rejects.toThrow();
    await expect(failedClient("THYAO.IS")).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("expires cached data and keeps history ranges separate", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ chart: { result: [chart()] } })),
    );
    const client = createYahooClient(fetcher);
    await client("THYAO.IS");
    await client("THYAO.IS", "3mo");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60001);
    await client("THYAO.IS");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("aborts timed out requests and does not cache failure", async () => {
    vi.useFakeTimers();
    const client = createYahooClient(
      vi.fn(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new Error("timeout")),
              { once: true },
            );
          }),
      ),
      50,
    );
    const assertion = expect(client("THYAO.IS")).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects malformed JSON and missing provider results", async () => {
    for (const body of [
      "invalid json",
      JSON.stringify({ chart: { result: null } }),
      JSON.stringify({ chart: { result: [{ meta: {} }] } }),
    ]) {
      await expect(
        createYahooClient(async () => new Response(body))("THYAO.IS"),
      ).rejects.toThrow();
    }
  });

  it("validates symbols, ranges and limits instead of silently replacing inputs", () => {
    expect(stockInput.parse({ symbol: " thyao " }).symbol).toBe("THYAO");
    expect(() => stockInput.parse({ symbol: "" })).toThrow();
    expect(() => stockInput.parse({ symbol: "../THYAO" })).toThrow();
    expect(() => historyInput.parse({ range: "unbounded" })).toThrow();
    expect(() => batchInput.parse({ limit: -1 })).toThrow();
    expect(() => batchInput.parse({ limit: 1.5 })).toThrow();
  });
});
