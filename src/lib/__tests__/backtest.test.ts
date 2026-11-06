import { describe, expect, it } from "vitest";
import { runWalkForwardBacktest } from "../backtest";

const history = Array.from({ length: 71 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  open: 99 + i,
  high: 102 + i,
  low: 98 + i,
  close: 100 + i,
  volume: 1000,
}));

describe("walk-forward evaluation", () => {
  it("predicts using past candles only and aligns each forecast to its target date", async () => {
    const seen: number[] = [];
    const result = await runWalkForwardBacktest(
      history,
      "TEST",
      async (past) => {
        seen.push(past.length);
        return past.at(-1)!.close + 5;
      },
    );
    expect(seen).toEqual([51, 56, 61, 66]);
    expect(result.points[0].originDate).toBe(history[50].date);
    expect(result.points[0].date).toBe(history[55].date);
    expect(result.points[0].entryPrice).toBe(history[51].open);
    expect(result.mape).toBe(0);
    expect(result.directionAccuracy).toBe(100);
    expect(result.strategyReturn).toBeCloseTo((170 / 150 - 1) * 100, 8);
    expect(result.buyHoldReturn).toBeCloseTo(result.strategyReturn, 8);
  });

  it("distinguishes staying in cash from buying and holding the stock", async () => {
    const result = await runWalkForwardBacktest(
      history,
      "TEST",
      async (past) => past.at(-1)!.close - 5,
    );
    expect(result.strategyReturn).toBe(0);
    expect(result.buyHoldReturn).toBeGreaterThan(0);
    expect(result.trades).toBe(0);
    expect(result.directionAccuracy).toBe(0);
  });

  it("uses the next session open for execution and compounds non-overlapping trades", async () => {
    const prices = history.map((c) => ({ ...c }));
    prices[51].open = 160;
    prices[51].high = 162;
    const result = await runWalkForwardBacktest(
      prices,
      "TEST",
      async (past) => past.at(-1)!.close + 5,
    );
    expect(result.strategyReturn).toBeCloseTo((170 / 160 - 1) * 100, 8);
    expect(result.points[0].entryPrice).toBe(160);
    expect(result.points[0].tradeReturn).toBeLessThan(0);
  });

  it("rejects insufficient, unsorted or invalid prediction data", async () => {
    await expect(
      runWalkForwardBacktest(history.slice(0, 50), "TEST", async () => 1),
    ).rejects.toThrow();
    await expect(
      runWalkForwardBacktest([...history].reverse(), "TEST", async () => 1),
    ).rejects.toThrow();
    await expect(
      runWalkForwardBacktest(history, "TEST", async () => NaN),
    ).rejects.toThrow();
  });
});
