import { beforeEach, describe, expect, it, vi } from "vitest";

const { provider } = vi.hoisted(() => ({ provider: vi.fn() }));

// Execute the actual validators and handlers without an HTTP transport.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown): unknown => input;
    const builder = {
      validator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: { data: unknown }) => unknown) =>
        (options: { data?: unknown } = {}) =>
          fn({ data: validate(options.data) }),
    };
    return builder;
  },
}));
vi.mock("../market-feed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../market-feed")>();
  return { ...actual, createYahooClient: () => provider };
});

import {
  BIST_SYMBOLS,
  fetchBistData,
  fetchSingleStock,
  fetchStockHistory,
  fetchSingleAiAnalysis,
} from "../ai.functions";
const chart = (symbol: string) => ({
  meta: {
    symbol,
    regularMarketPrice: 100,
    previousClose: 100,
    regularMarketTime: 1780000000,
  },
  timestamp: [1780000000],
  indicators: {
    quote: [{ open: [99], high: [101], low: [98], close: [100], volume: [0] }],
  },
});

beforeEach(() => {
  provider.mockReset();
  provider.mockImplementation(async (symbol) => chart(symbol));
});

describe("market server functions", () => {
  it("passes actual candle ranges and provider currency into the AI engine", async () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i / 10);
    provider.mockResolvedValue({
      ...chart("AAPL"),
      meta: { ...chart("AAPL").meta, currency: "USD" },
      timestamp: closes.map((_, i) => 1770000000 + i * 86400),
      indicators: {
        quote: [
          {
            open: closes,
            close: closes,
            high: closes.map((c) => c + 8),
            low: closes.map((c) => c - 7),
            volume: closes.map(() => 1000),
          },
        ],
      },
    });
    const result = await fetchSingleAiAnalysis({
      data: { symbol: "AAPL", dataCount: 60 },
    });
    expect(result.analysis.currency).toBe("USD");
    expect(result.analysis.indicators.atr).toBeCloseTo(15, 8);
    provider.mockRejectedValue(new Error("offline"));
    await expect(
      fetchSingleAiAnalysis({ data: { symbol: "AAPL" } }),
    ).rejects.toThrow();
  });
  it("applies the requested limit before issuing provider requests", async () => {
    const result = await fetchBistData({ data: { limit: 2 } });
    expect(provider.mock.calls.map(([symbol]) => symbol)).toEqual(
      BIST_SYMBOLS.slice(0, 2).map((s) => `${s}.IS`),
    );
    expect(result.requestedCount).toBe(2);
    expect(result.stocks).toHaveLength(2);
  });

  it("reports incomplete batches and rejects an entirely unavailable provider", async () => {
    provider.mockImplementation(async (symbol) => {
      if (symbol === `${BIST_SYMBOLS[0]}.IS`) throw new Error("offline");
      return chart(symbol);
    });
    const result = await fetchBistData({ data: { limit: 2 } });
    expect(result.unavailableSymbols).toEqual([BIST_SYMBOLS[0]]);
    expect(result.stocks).toHaveLength(1);
    provider.mockRejectedValue(new Error("offline"));
    await expect(fetchBistData({ data: { limit: 2 } })).rejects.toThrow();
  });

  it("keeps valid symbols and does not substitute another stock on failure", async () => {
    const quote = await fetchSingleStock({ data: { symbol: " thyao " } });
    expect(quote.symbol).toBe("THYAO.IS");
    expect(quote.changePercent).toBe(0);
    provider.mockRejectedValue(new Error("unknown stock"));
    await expect(
      fetchSingleStock({ data: { symbol: "UNKNOWN" } }),
    ).rejects.toThrow();
  });

  it("does not hide history failures as successful empty data", async () => {
    expect(
      await fetchStockHistory({ data: { symbol: "THYAO", range: "3mo" } }),
    ).toHaveLength(1);
    provider.mockRejectedValue(new Error("timeout"));
    await expect(
      fetchStockHistory({ data: { symbol: "THYAO" } }),
    ).rejects.toThrow();
  });
});
