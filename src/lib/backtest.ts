import {
  runAIEngine,
  validateAnalysisCandles,
  type AnalysisCandle,
} from "./ml.engine";

type Candle = AnalysisCandle & { open: number; date: string };
type Predictor = (
  past: Candle[],
  horizon: number,
  symbol: string,
) => Promise<number>;
export type BacktestPoint = {
  originDate: string;
  date: string;
  currentPrice: number;
  predicted: number;
  actualAtHorizon: number;
  entryPrice: number;
  invested: boolean;
  tradeReturn: number;
};

const predict: Predictor = async (past, horizon, symbol) => {
  const result = await runAIEngine(past, symbol, past.length);
  const forecast = result.predictions.find((p) => p.horizonDays === horizon);
  if (!forecast) throw new Error("Tahmin ufku bulunamadı.");
  return forecast.expectedPrice;
};

export async function runWalkForwardBacktest(
  history: Candle[],
  symbol: string,
  predictor: Predictor = predict,
) {
  validateAnalysisCandles(history);
  const horizon = 5;
  const start = Math.max(50, Math.floor(history.length / 2));
  if (start + horizon >= history.length)
    throw new Error("Backtest için yeterli geçmiş veri bulunamadı.");
  if (
    history.some(
      (c, i) =>
        !Number.isFinite(Date.parse(c.date)) ||
        (i > 0 && Date.parse(c.date) <= Date.parse(history[i - 1].date)) ||
        !Number.isFinite(c.open) ||
        c.open <= 0 ||
        c.open < c.low ||
        c.open > c.high,
    )
  ) {
    throw new Error("Backtest için sıralı ve geçerli OHLCV verisi gerekir.");
  }
  const points: BacktestPoint[] = [];
  let capital = 1;
  let matches = 0;
  let error = 0;
  for (let i = start; i + horizon < history.length; i += horizon) {
    const past = history.slice(0, i + 1);
    const predicted = await predictor(past, horizon, symbol);
    if (!Number.isFinite(predicted) || predicted <= 0)
      throw new Error("Geçersiz backtest tahmini.");
    const currentPrice = history[i].close;
    const actualAtHorizon = history[i + horizon].close;
    // The signal is known after the origin close; execution starts next session.
    const entryPrice = history[i + 1].open;
    const invested = predicted > currentPrice;
    const tradeReturn = invested ? (actualAtHorizon / entryPrice - 1) * 100 : 0;
    capital *= 1 + tradeReturn / 100;
    if (
      Math.sign(predicted - currentPrice) ===
      Math.sign(actualAtHorizon - currentPrice)
    )
      matches++;
    error += (Math.abs(predicted - actualAtHorizon) / actualAtHorizon) * 100;
    points.push({
      originDate: history[i].date,
      date: history[i + horizon].date,
      currentPrice,
      predicted,
      actualAtHorizon,
      entryPrice,
      invested,
      tradeReturn,
    });
  }
  return {
    points,
    directionAccuracy: (matches / points.length) * 100,
    mape: error / points.length,
    strategyReturn: (capital - 1) * 100,
    buyHoldReturn:
      (points[points.length - 1].actualAtHorizon / history[start + 1].open -
        1) *
      100,
    trades: points.filter((point) => point.invested).length,
    horizon,
    startDate: history[start + 1].date,
    endDate: points[points.length - 1].date,
  };
}
