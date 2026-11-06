// ml.engine.ts
// Kapsamlı Algoritmik ve Matematiksel Karar Motoru (LLM veya dış API kullanılmaz)

export type AnalysisCandle = { close: number; high: number; low: number; volume: number };
export function validateAnalysisCandles(history: AnalysisCandle[]) {
  if (history.length < 50) throw new Error("Analiz için en az 50 geçerli günlük mum gerekir.");
  if (history.some(c => ![c.close, c.high, c.low, c.volume].every(Number.isFinite) || c.close <= 0 || c.low <= 0 || c.low > c.close || c.high < c.close || c.volume < 0)) throw new Error("Geçersiz OHLCV verisi.");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type MLModelName = "RidgeRegression" | "MomentumExtrapolation" | "MeanReversion" | "EMA_Projection";

export interface ModelPrediction {
  model: MLModelName;
  prediction: number;
  weight: number;
  mape: number | null;
}

export interface HorizonPrediction {
  horizonDays: number;
  expectedPrice: number;
  lowerBand: number;
  upperBand: number;
  expectedReturnPercent: number;
  evaluationScore: number | null;
  mape: number | null;
  models: ModelPrediction[];
  evaluationSamples?: number;
}

export interface KronosPrediction {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EngineResult {
  currency: string;
  decision: "AL" | "SAT" | "BEKLE";
  signalScore: number;
  rawScore: number;
  currentPrice: number;
  volatility: number;
  trend: "YÜKSELEN" | "DÜŞEN" | "YATAY";
  predictions: HorizonPrediction[];
  indicators: {
    rsi: number;
    macd: number;
    macdSignal: number;
    sma20: number;
    sma50: number;
    stochastic: { k: number; d: number };
    adx: number;
    cci: number;
    obv: number;
    vwap: number;
    atr: number;
  };
  regime: "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "HIGH_VOLATILITY";
  riskManagement: {
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    suggestedPositionSize: number | null;
    riskRewardRatio: number;
  };
  supportLevels: number[];
  resistanceLevels: number[];
  interpolatedPredictions?: HorizonPrediction[];
  basePredictions?: HorizonPrediction[];
  kronosPredictions?: KronosPrediction[];
}

export interface SimpleTechnicalResult {
  decision: "AL" | "SAT" | "BEKLE";
  rawScore: number;
  currentPrice: number;
}

// ─── Volatility (canonical) ──────────────────────────────────────────────────

/** Compute annualized volatility from daily closes (%). */
export function calcVolatility(closes: number[]): number {
  if (closes.some(price => !Number.isFinite(price) || price <= 0)) throw new Error("Volatilite için geçerli fiyatlar gereklidir.");
  const prices = closes.slice(-61);
  if (prices.length < 3) return 0;
  const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

// ─── Core Indicators ─────────────────────────────────────────────────────────

/** Simple Moving Average */
export function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** Exponential Moving Average */
export function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/** RSI using Wilder's exponential smoothing */
export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/** Bollinger Bands */
export function calcBollinger(closes: number[], period = 20): { upper: number; middle: number; lower: number } {
  const middle = calcSMA(closes, period);
  if (closes.length < period) return { upper: middle * 1.02, middle, lower: middle * 0.98 };
  const slice = closes.slice(-period);
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: middle + 2 * std, middle, lower: middle - 2 * std };
}

/** MACD (signal = EMA9 of MACD line, not of raw prices) */
export function calcMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  const ema12Series: number[] = [];
  const macdSeries: number[] = [];
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

  for (let i = 0; i < closes.length; i++) {
    if (i >= 12) ema12 = closes[i] * k12 + ema12 * (1 - k12);
    if (i >= 26) ema26 = closes[i] * k26 + ema26 * (1 - k26);
    ema12Series.push(ema12);
    macdSeries.push(ema12 - ema26);
  }

  // Signal line = EMA9 of MACD series
  const signalK = 2 / 10;
  let signal = macdSeries.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdSeries.length; i++) {
    signal = macdSeries[i] * signalK + signal * (1 - signalK);
  }

  const macd = macdSeries[macdSeries.length - 1] || 0;
  return { macd, signal, hist: macd - signal };
}

/** Stochastic Oscillator: %K = (Close-LowN)/(HighN-LowN)*100, %D = SMA3(%K) */
export function calcStochastic(
  closes: number[],
  highs: number[],
  lows: number[],
  kPeriod = 14,
  dPeriod = 3,
): { k: number; d: number } {
  if (closes.length < kPeriod) return { k: 50, d: 50 };
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highMax = -Infinity;
    let lowMin = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highMax) highMax = highs[j];
      if (lows[j] < lowMin) lowMin = lows[j];
    }
    const range = highMax - lowMin;
    kValues.push(range === 0 ? 50 : ((closes[i] - lowMin) / range) * 100);
  }
  const k = kValues[kValues.length - 1] || 50;
  const d = kValues.length >= dPeriod
    ? kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod
    : k;
  return { k, d };
}

/** Average True Range (Wilder's smoothing) */
export function calcATR(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 14,
): number {
  if (closes.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length || 0;
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

/** Average Directional Index */
export function calcADX(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 14,
): number {
  if (closes.length < period + 1) return 25;
  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    trueRanges.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (trueRanges.length < period) return 25;

  // Wilder smoothing
  let smoothedTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trueRanges[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    dxValues.push(diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100);
  }

  if (dxValues.length < period) return dxValues.length > 0 ? dxValues[dxValues.length - 1] : 25;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  return adx;
}

/** Commodity Channel Index */
export function calcCCI(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 20,
): number {
  if (closes.length < period) return 0;
  const tpArr: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tpArr.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  const slice = tpArr.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const meanDev = slice.reduce((a, v) => a + Math.abs(v - sma), 0) / period;
  if (meanDev === 0) return 0;
  return (tpArr[tpArr.length - 1] - sma) / (0.015 * meanDev);
}

/** On-Balance Volume */
export function calcOBV(closes: number[], volumes: number[]): number {
  if (closes.length < 2) return 0;
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

/** Volume Weighted Average Price */
export function calcVWAP(
  closes: number[],
  volumes: number[],
  highs: number[],
  lows: number[],
): number {
  if (closes.length === 0) return 0;
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * volumes[i];
    cumV += volumes[i];
  }
  return cumV > 0 ? cumPV / cumV : closes[closes.length - 1];
}

// ─── Support / Resistance (swing-point detection) ────────────────────────────

/** Detect support and resistance levels using swing points with Fibonacci fallback */
export function findSupportResistance(closes: number[]): { supports: number[]; resistances: number[] } {
  if (closes.length < 20) return { supports: [], resistances: [] };

  const swingLows: number[] = [];
  const swingHighs: number[] = [];
  const lookback = 5;

  for (let i = lookback; i < closes.length - lookback; i++) {
    let isSwingLow = true;
    let isSwingHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (closes[j] <= closes[i]) isSwingLow = false;
      if (closes[j] >= closes[i]) isSwingHigh = false;
    }
    if (isSwingLow) swingLows.push(closes[i]);
    if (isSwingHigh) swingHighs.push(closes[i]);
  }

  const currentPrice = closes[closes.length - 1];

  const supports = swingLows
    .filter((s) => s < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 3);

  const resistances = swingHighs
    .filter((r) => r > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 3);

  // Fallback: Fibonacci retracements
  if (supports.length < 3) {
    const recent = closes.slice(-60);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    for (const fib of [0.236, 0.382, 0.5, 0.618, 0.786]) {
      const level = currentPrice - range * fib;
      if (level < currentPrice && !supports.includes(level)) {
        supports.push(level);
        if (supports.length >= 3) break;
      }
    }
  }
  if (resistances.length < 3) {
    const recent = closes.slice(-60);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    for (const fib of [0.786, 0.618, 0.5, 0.382, 0.236]) {
      const level = currentPrice + range * fib;
      if (level > currentPrice && !resistances.includes(level)) {
        resistances.push(level);
        if (resistances.length >= 3) break;
      }
    }
  }

  return { supports: supports.slice(0, 3), resistances: resistances.slice(0, 3) };
}

// ─── Regime Detection ────────────────────────────────────────────────────────

/** Detect market regime: trending up, trending down, ranging, or high volatility */
export function detectRegime(
  closes: number[],
  volatility: number,
): "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "HIGH_VOLATILITY" {
  if (volatility > 30) return "HIGH_VOLATILITY";
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const slope = (sma20 - sma50) / sma50 * 100;
  if (slope > 2) return "TRENDING_UP";
  if (slope < -2) return "TRENDING_DOWN";
  return "RANGING";
}

// ─── Prediction Models ───────────────────────────────────────────────────────

function predictRidgeRegression(closes: number[], horizon: number): number {
  const n = closes.length;
  if (n < 10) return closes[n - 1] || 0;

  const window = closes.slice(-Math.min(60, n));
  const wLen = window.length;
  const alpha = 1.0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < wLen; i++) {
    sumX += i;
    sumY += window[i];
    sumXY += i * window[i];
    sumX2 += i * i;
  }

  const denom = wLen * sumX2 - sumX * sumX + alpha * wLen;
  const slope = denom === 0 ? 0 : (wLen * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / wLen;

  const predicted = slope * (wLen - 1 + horizon) + intercept;
  const current = closes[n - 1];
  return Math.max(current * 0.7, Math.min(current * 1.3, predicted));
}

function predictMomentum(closes: number[], horizon: number): number {
  if (closes.length < 10) return closes[closes.length - 1] || 0;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 10];
  if (past <= 0) return current;
  const dailyRate = Math.pow(current / past, 1 / 10) - 1;
  const dampedRate = dailyRate * 0.5;
  return current * Math.pow(1 + dampedRate, horizon);
}

function predictMeanReversion(closes: number[], horizon: number): number {
  const current = closes[closes.length - 1] || 0;
  const sma50 = calcSMA(closes, 50);
  const diff = sma50 - current;
  const reversionRate = 0.04; // 4% daily reversion (realistic)
  return current + diff * (1 - Math.pow(1 - reversionRate, horizon));
}

function predictEMAProjection(closes: number[], horizon: number): number {
  if (closes.length < 2) return closes[closes.length - 1] || 0;
  const ema10 = calcEMA(closes, 10);
  const ema20 = calcEMA(closes, 20);
  const diff = ema10 - ema20;
  // Exponential decay: converge toward EMA20
  const decayRate = 0.05;
  const convergence = 1 - Math.pow(1 - decayRate, horizon);
  const current = closes[closes.length - 1];
  return current + diff * convergence;
}

// ─── Interpolation (Numeric) ────────────────────────────────────────────────

function interpolateNumericValues(xs: number[], ys: number[], targets: number[]): number[] {
  return targets.map((tx) => {
    if (tx <= xs[0]) return ys[0];
    if (tx >= xs[xs.length - 1]) return ys[ys.length - 1];

    let i = 0;
    for (let j = 0; j < xs.length - 1; j++) {
      if (tx >= xs[j] && tx <= xs[j + 1]) { i = j; break; }
    }

    const h = xs[i + 1] - xs[i];
    if (h === 0) return ys[i];

    const t = (tx - xs[i]) / h;
    return ys[i] + t * (ys[i + 1] - ys[i]);
  });
}

export function interpolatePredictions(
  basePredictions: HorizonPrediction[],
  targetCount: number,
): HorizonPrediction[] {
  if (basePredictions.length < 2) return basePredictions;

  const minHorizon = basePredictions[0].horizonDays;
  const maxHorizon = basePredictions[basePredictions.length - 1].horizonDays;

  const step = (maxHorizon - minHorizon) / (targetCount - 1);
  const targetHorizons = Array.from({ length: targetCount }, (_, i) => Math.round(minHorizon + i * step));

  const xs = basePredictions.map((p) => p.horizonDays);
  const currentPrice = basePredictions[0].expectedPrice / (1 + basePredictions[0].expectedReturnPercent / 100);

  const interpExpected = interpolateNumericValues(xs, basePredictions.map((p) => p.expectedPrice), targetHorizons);
  const interpLower = interpolateNumericValues(xs, basePredictions.map((p) => p.lowerBand), targetHorizons);
  const interpUpper = interpolateNumericValues(xs, basePredictions.map((p) => p.upperBand), targetHorizons);
  const interpScore = interpolateNumericValues(xs, basePredictions.map((p) => p.evaluationScore ?? 0), targetHorizons);
  const interpMape = interpolateNumericValues(xs, basePredictions.map((p) => p.mape ?? 0), targetHorizons);

  return targetHorizons.map((h, i) => ({
    horizonDays: h,
    expectedPrice: interpExpected[i],
    lowerBand: interpLower[i],
    upperBand: interpUpper[i],
    expectedReturnPercent: ((interpExpected[i] - currentPrice) / currentPrice) * 100,
    evaluationScore: basePredictions.some(p => p.evaluationScore === null) ? null : Math.max(10, Math.min(99, interpScore[i])),
    mape: basePredictions.some(p => p.mape === null) ? null : interpMape[i],
    models: basePredictions[Math.min(i, basePredictions.length - 1)].models,
  }));
}

// ─── Forecast evaluation ────────────────────────────────────────────────────

const FORECAST_MODELS: Array<{ name: MLModelName; fn: (closes: number[], horizon: number) => number }> = [
  { name: "RidgeRegression", fn: predictRidgeRegression },
  { name: "MomentumExtrapolation", fn: predictMomentum },
  { name: "MeanReversion", fn: predictMeanReversion },
  { name: "EMA_Projection", fn: predictEMAProjection },
];

function boundedPrediction(fn: (c: number[], h: number) => number, closes: number[], horizon: number) {
  const current = closes[closes.length - 1];
  return Math.max(current * 0.5, Math.min(current * 1.5, fn(closes, horizon)));
}

function evaluationPoints(length: number, horizon: number) {
  return [...new Set([0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map(fraction => Math.floor(length * fraction)))].filter(i => i >= 29 && i + horizon < length);
}

function modelWeights(closes: number[], horizon: number) {
  const points = evaluationPoints(closes.length, horizon);
  const evaluated = FORECAST_MODELS.map(model => {
    const errors = points.map(i => {
      const predicted = boundedPrediction(model.fn, closes.slice(0, i + 1), horizon);
      const actual = closes[i + horizon];
      return Math.abs(predicted - actual) / actual * 100;
    });
    const mape = errors.length ? errors.reduce((sum, error) => sum + error, 0) / errors.length : null;
    return { ...model, mape, inverseError: mape === null ? 1 : 1 / Math.max(mape, 0.1) };
  });
  const total = evaluated.reduce((sum, model) => sum + model.inverseError, 0);
  return evaluated.map(model => ({ ...model, weight: model.inverseError / total }));
}

async function calculateEnsemblePrediction(closes: number[], horizon: number): Promise<HorizonPrediction> {
  const currentPrice = closes[closes.length - 1];
  const weights = modelWeights(closes, horizon);
  const models = weights.map(model => ({ model: model.name, prediction: boundedPrediction(model.fn, closes, horizon), weight: model.weight, mape: model.mape }));
  const expectedPrice = models.reduce((sum, model) => sum + model.prediction * model.weight, 0);
  const points = evaluationPoints(closes.length, horizon);
  let totalError = 0;
  let directionMatches = 0;
  // At each historical origin, fit weights using that origin's past only.
  for (const i of points) {
    const past = closes.slice(0, i + 1);
    const predicted = modelWeights(past, horizon).reduce((sum, model) => sum + boundedPrediction(model.fn, past, horizon) * model.weight, 0);
    const actual = closes[i + horizon];
    totalError += Math.abs(predicted - actual) / actual * 100;
    if (Math.sign(predicted - closes[i]) === Math.sign(actual - closes[i])) directionMatches++;
  }
  const mape = points.length ? totalError / points.length : null;
  // Heuristic dispersion only: these are not calibrated confidence intervals.
  const dailyVolatility = calcVolatility(closes) / 100 / Math.sqrt(252);
  const bandWidth = currentPrice * dailyVolatility * Math.sqrt(horizon);
  return {
    horizonDays: horizon, expectedPrice,
    lowerBand: Math.max(0, expectedPrice - bandWidth), upperBand: expectedPrice + bandWidth,
    expectedReturnPercent: (expectedPrice / currentPrice - 1) * 100,
    evaluationScore: points.length ? Math.max(10, Math.min(99, directionMatches / points.length * 100 - (mape ?? 0) * 3)) : null,
    mape, models, evaluationSamples: points.length,
  };
}

// ─── Risk Management ─────────────────────────────────────────────────────────

function computeRiskManagement(currentPrice: number, supports: number[], resistances: number[], atr: number): EngineResult["riskManagement"] {
  const range = Math.max(atr, currentPrice * 0.01);
  const support = supports.filter(price => price > 0 && price < currentPrice).sort((a, b) => b - a)[0];
  const resistance = resistances.filter(price => price * 0.98 > currentPrice).sort((a, b) => a - b)[0];
  const suggestedStopLoss = Math.max(currentPrice * 0.01, support ? support * 0.98 : currentPrice - 2 * range);
  const suggestedTakeProfit = resistance ? resistance * 0.98 : currentPrice + 3 * range;
  return { suggestedStopLoss, suggestedTakeProfit, suggestedPositionSize: null, riskRewardRatio: (suggestedTakeProfit - currentPrice) / (currentPrice - suggestedStopLoss) };
}

// ─── Main AI Engine ──────────────────────────────────────────────────────────

export async function runAIEngine(
  history: AnalysisCandle[],
  _symbol: string,
  dataCount: number = 252,
  currency: string = "—",
): Promise<EngineResult> {
  if (!Number.isInteger(dataCount) || dataCount < 50 || dataCount > 1250) throw new Error("Veri sayısı 50–1250 arasında olmalıdır.");
  const slicedHistory = history.slice(-dataCount);
  validateAnalysisCandles(slicedHistory);
  if (slicedHistory.length < 50) {
    throw new Error("Analiz için en az 50 günlük geçmiş veri gereklidir.");
  }

  const closes = slicedHistory.map((h) => h.close);
  const volumes = slicedHistory.map((h) => h.volume || 0);
  const currentPrice = closes[closes.length - 1];

  const highs = slicedHistory.map(c => c.high);
  const lows = slicedHistory.map(c => c.low);

  // Core indicators
  const rsi = calcRSI(closes, 14);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const macdResult = calcMACD(closes);
  const stochastic = calcStochastic(closes, highs, lows, 14, 3);
  const adx = calcADX(closes, highs, lows, 14);
  const cci = calcCCI(closes, highs, lows, 20);
  const obv = calcOBV(closes, volumes);
  const vwap = calcVWAP(closes, volumes, highs, lows);
  const atr = calcATR(closes, highs, lows, 14);
  const volatility = calcVolatility(closes);
  const regime = detectRegime(closes, volatility);

  // Trend
  const trend: "YÜKSELEN" | "DÜŞEN" | "YATAY" = sma20 > sma50 ? "YÜKSELEN" : sma20 < sma50 * 0.95 ? "DÜŞEN" : "YATAY";

  // Support / resistance
  const { supports, resistances } = findSupportResistance(closes);

  // Predictions
  const horizons = [1, 2, 3, 5, 7, 10, 15, 20, 30, 40, 60, 80, 120];
  const basePredictions = await Promise.all(horizons.map((h) => calculateEnsemblePrediction(closes, h)));
  const predictions = basePredictions;

  // ── Scoring ──────────────────────────────────────────────────────────────
  let score = 50;

  // RSI
  if (rsi < 30) score += 15;
  else if (rsi > 70) score -= 15;

  // MACD
  if (macdResult.macd > macdResult.signal) score += 10;
  else score -= 10;

  // Trend
  if (trend === "YÜKSELEN") score += 10;
  if (trend === "DÜŞEN") score -= 10;

  // 20-day prediction
  const pred20 = predictions.reduce((best, p) => {
    const diff = Math.abs(p.horizonDays - 20);
    return diff < Math.abs(best.horizonDays - 20) ? p : best;
  }, predictions[0]);
  if (pred20) {
    if (pred20.expectedReturnPercent > 3) score += 15;
    else if (pred20.expectedReturnPercent < -3) score -= 15;
    if (pred20.mape !== null && pred20.mape > 10) {
      score = score > 50 ? score - 10 : score + 10;
    }
  }

  // Stochastic
  if (stochastic.k < 20 && stochastic.d < 20) score += 10;
  if (stochastic.k > 80 && stochastic.d > 80) score -= 10;

  // ADX (trend strength amplifier)
  if (adx > 25 && trend === "YÜKSELEN") score += 5;
  if (adx > 25 && trend === "DÜŞEN") score -= 5;

  // CCI
  if (cci < -100) score += 5;
  if (cci > 100) score -= 5;

  // Volume confirmation
  if (obv > 0 && trend === "YÜKSELEN") score += 5;
  if (obv < 0 && trend === "DÜŞEN") score -= 5;

  if (regime === "RANGING" && score >= 60) score -= 5;

  // ── Decision ─────────────────────────────────────────────────────────────
  let decision: "AL" | "SAT" | "BEKLE" = "BEKLE";
  if (score >= 60) decision = "AL";
  else if (score <= 40) decision = "SAT";

  // Regime adjustments
  if (regime === "HIGH_VOLATILITY" && decision === "AL") decision = "BEKLE";

  // Safety: high volatility overrides
  if (decision === "AL" && volatility > 25) decision = "BEKLE";

  const signalScore = Math.max(0, Math.min(100, score));

  const riskManagement = computeRiskManagement(currentPrice, supports, resistances, atr);

  return {
    decision,
    signalScore,
    currency,
    rawScore: score,
    currentPrice,
    volatility,
    trend,
    predictions,
    indicators: {
      rsi,
      macd: macdResult.macd,
      macdSignal: macdResult.signal,
      sma20,
      sma50,
      stochastic,
      adx,
      cci,
      obv,
      vwap,
      atr,
    },
    regime,
    riskManagement,
    supportLevels: supports,
    resistanceLevels: resistances,
    interpolatedPredictions: predictions,
    basePredictions,
  };
}

// ─── Simple Technical Engine (lightweight scanner) ───────────────────────────

export function runSimpleTechnicalEngine(
  history: AnalysisCandle[],
  _symbol: string,
): SimpleTechnicalResult {
  validateAnalysisCandles(history);
  const closes = history.map((h) => h.close);
  const currentPrice = closes[closes.length - 1];

  const highs = history.map((h) => h.high);
  const lows = history.map((h) => h.low);

  const rsi = calcRSI(closes, 14);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const macdResult = calcMACD(closes);
  const stochastic = calcStochastic(closes, highs, lows, 14, 3);
  const adx = calcADX(closes, highs, lows, 14);
  const volatility = calcVolatility(closes);

  const trend: "YÜKSELEN" | "DÜŞEN" | "YATAY" = sma20 > sma50 ? "YÜKSELEN" : sma20 < sma50 * 0.95 ? "DÜŞEN" : "YATAY";

  let score = 50;

  // RSI
  if (rsi < 30) score += 15;
  else if (rsi > 70) score -= 15;

  // MACD
  if (macdResult.macd > macdResult.signal) score += 10;
  else score -= 10;

  // Trend
  if (trend === "YÜKSELEN") score += 10;
  else if (trend === "DÜŞEN") score -= 10;

  // Price-SMA divergence
  if (currentPrice < sma20 * 0.95) score += 10;
  else if (currentPrice > sma20 * 1.05) score -= 10;

  // Stochastic
  if (stochastic.k < 20 && stochastic.d < 20) score += 5;
  if (stochastic.k > 80 && stochastic.d > 80) score -= 5;

  // ADX
  if (adx > 25 && trend === "YÜKSELEN") score += 5;
  if (adx > 25 && trend === "DÜŞEN") score -= 5;

  let decision: "AL" | "SAT" | "BEKLE" = "BEKLE";
  if (score >= 60) decision = "AL";
  else if (score <= 40) decision = "SAT";

  if (decision === "AL" && volatility > 25) decision = "BEKLE";

  return { decision, rawScore: score, currentPrice };
}
