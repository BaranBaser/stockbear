import { describe, expect, it } from "vitest";
import {
  calcATR,
  calcVolatility,
  runAIEngine,
  runSimpleTechnicalEngine,
} from "../ml.engine";

const candles = (count = 80) =>
  Array.from({ length: count }, (_, i) => {
    const close = 100 + i * 0.2 + Math.sin(i / 3);
    return {
      open: close - 0.5,
      high: close + 8,
      low: close - 7,
      close,
      volume: 1000 + i,
    };
  });

describe("analysis data quality", () => {
  it("uses observed high/low values instead of synthetic price ranges", async () => {
    const history = candles();
    const result = await runAIEngine(history, "TEST");
    expect(result.indicators.atr).toBeCloseTo(
      calcATR(
        history.map((c) => c.close),
        history.map((c) => c.high),
        history.map((c) => c.low),
      ),
      8,
    );
    const narrow = await runAIEngine(
      history.map((c) => ({ ...c, high: c.close + 1, low: c.close - 1 })),
      "TEST",
    );
    expect(result.indicators.atr).toBeGreaterThan(narrow.indicators.atr);
  });

  it("rejects insufficient or invalid OHLCV data instead of inventing values", async () => {
    await expect(runAIEngine(candles(40), "TEST")).rejects.toThrow();
    await expect(
      runAIEngine(
        candles().map((c) => ({ ...c, high: c.low - 1 })),
        "TEST",
      ),
    ).rejects.toThrow();
    await expect(
      runAIEngine(
        candles().map((c) => ({ ...c, volume: -1 })),
        "TEST",
      ),
    ).rejects.toThrow();
    await expect(runAIEngine(candles(), "TEST", 0)).rejects.toThrow();
    expect(() => runSimpleTechnicalEngine(candles(40), "TEST")).toThrow();
  });

  it("annualizes sample log-return volatility using 252 trading sessions", () => {
    const returns = [Math.log(1.1), Math.log(0.9), Math.log(1.1)];
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / 2;
    expect(calcVolatility([100, 110, 99, 108.9])).toBeCloseTo(
      Math.sqrt(variance * 252) * 100,
      8,
    );
    expect(calcVolatility(Array(60).fill(100))).toBe(0);
  });

  it("keeps exact forecast horizons and reports missing evaluation data explicitly", async () => {
    const result = await runAIEngine(candles(60), "TEST");
    expect(result.predictions.map((p) => p.horizonDays)).toContain(20);
    const long = result.predictions.find((p) => p.horizonDays === 120)!;
    expect(long.mape).toBeNull();
    expect(long.evaluationSamples).toBe(0);
    expect(long.evaluationScore).toBeNull();
    expect(
      long.models.every(
        (model) => model.mape === null && model.weight === 0.25,
      ),
    ).toBe(true);
    expect(result.riskManagement.suggestedPositionSize).toBeNull();
    expect(result.riskManagement.suggestedStopLoss).toBeGreaterThan(0);
    expect(result.riskManagement.suggestedStopLoss).toBeLessThan(
      result.currentPrice,
    );
    expect(result.riskManagement.suggestedTakeProfit).toBeGreaterThan(
      result.currentPrice,
    );
  });

  it("measures zero historical percentage error for a constant price series", async () => {
    const result = await runAIEngine(
      candles(100).map((c) => ({
        ...c,
        close: 100,
        open: 100,
        high: 102,
        low: 98,
      })),
      "TEST",
    );
    const forecast = result.predictions.find((p) => p.horizonDays === 5)!;
    expect(forecast.evaluationSamples).toBeGreaterThan(0);
    expect(forecast.mape).toBeCloseTo(0, 8);
    expect(
      forecast.models.every(
        (model) => model.mape !== null && model.mape < 1e-8,
      ),
    ).toBe(true);
    expect(
      forecast.models.reduce((sum, model) => sum + model.weight, 0),
    ).toBeCloseTo(1, 10);
  });
});
