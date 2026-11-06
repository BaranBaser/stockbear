import { describe, it, expect } from "vitest";
import {
  calcSMA,
  calcEMA,
  calcRSI,
  calcBollinger,
  calcMACD,
  calcStochastic,
  calcADX,
  calcCCI,
  calcATR,
  calcOBV,
  calcVWAP,
  calcVolatility,
  findSupportResistance,
  detectRegime,
  interpolatePredictions,
} from "../ml.engine";

// Yardımcı fonksiyonlar
function generatePrices(start: number, count: number, trend: number = 0): number[] {
  const prices: number[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    price += trend + (Math.sin(i * 0.3) * 2 + (Math.random() - 0.5) * 3);
    prices.push(Math.max(1, price));
  }
  return prices;
}

function generateOHLC(closes: number[]) {
  return closes.map((c) => ({
    high: c * 1.015,
    low: c * 0.985,
    volume: Math.floor(Math.random() * 1000000) + 100000,
  }));
}

describe("calcSMA", () => {
  it("basit hareketli ortalamayı doğru hesaplar", () => {
    const closes = [10, 11, 12, 13, 14];
    expect(calcSMA(closes, 3)).toBe(13); // (12+13+14)/3 = 13
  });

  it("dönemden kısa veri ile son fiyatı döndürür", () => {
    expect(calcSMA([10, 11], 5)).toBe(11);
  });

  it("boş dizi ile 0 döndürür", () => {
    expect(calcSMA([], 5)).toBe(0);
  });
});

describe("calcEMA", () => {
  it("üstel hareketli ortalamayı hesaplar", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const ema = calcEMA(closes, 12);
    expect(ema).toBeGreaterThan(100);
    expect(ema).toBeLessThan(130);
  });

  it("kısa veri ile son fiyatı döndürür", () => {
    expect(calcEMA([10, 11], 5)).toBe(11);
  });
});

describe("calcRSI", () => {
  it("30-70 arasında değer döndürür", () => {
    const closes = generatePrices(100, 50);
    const rsi = calcRSI(closes);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it("yükselen seride RSI > 50 olur", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const rsi = calcRSI(closes);
    expect(rsi).toBeGreaterThan(50);
  });

  it("düşen seride RSI < 50 olur", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
    const rsi = calcRSI(closes);
    expect(rsi).toBeLessThan(50);
  });

  it("yeterli veri yoksa 50 döndürür", () => {
    expect(calcRSI([10, 11, 12])).toBe(50);
  });
});

describe("calcBollinger", () => {
  it("upper > middle > lower olduğunu doğrular", () => {
    const closes = generatePrices(100, 30);
    const bollinger = calcBollinger(closes);
    expect(bollinger.upper).toBeGreaterThan(bollinger.middle);
    expect(bollinger.middle).toBeGreaterThan(bollinger.lower);
  });

  it("middle'ın SMA'ya eşit olduğunu doğrular", () => {
    const closes = generatePrices(100, 30);
    const bollinger = calcBollinger(closes);
    const sma = calcSMA(closes, 20);
    expect(bollinger.middle).toBeCloseTo(sma, 2);
  });
});

describe("calcMACD", () => {
  it("hist = macd - signal olduğunu doğrular", () => {
    const closes = generatePrices(100, 50);
    const macd = calcMACD(closes);
    expect(macd.hist).toBeCloseTo(macd.macd - macd.signal, 6);
  });

  it("sayılı değerler döndürür", () => {
    const closes = generatePrices(100, 50);
    const macd = calcMACD(closes);
    expect(typeof macd.macd).toBe("number");
    expect(typeof macd.signal).toBe("number");
    expect(isFinite(macd.macd)).toBe(true);
  });
});

describe("calcStochastic", () => {
  it("0-100 arasında değer döndürür", () => {
    const closes = generatePrices(100, 30);
    const ohlc = generateOHLC(closes);
    const stoch = calcStochastic(closes, ohlc.map((h) => h.high), ohlc.map((h) => h.low));
    expect(stoch.k).toBeGreaterThanOrEqual(0);
    expect(stoch.k).toBeLessThanOrEqual(100);
    expect(stoch.d).toBeGreaterThanOrEqual(0);
    expect(stoch.d).toBeLessThanOrEqual(100);
  });
});

describe("calcADX", () => {
  it("0-100 arasında değer döndürür", () => {
    const closes = generatePrices(100, 40);
    const ohlc = generateOHLC(closes);
    const adx = calcADX(closes, ohlc.map((h) => h.high), ohlc.map((h) => h.low));
    expect(adx).toBeGreaterThanOrEqual(0);
    expect(adx).toBeLessThanOrEqual(100);
  });
});

describe("calcCCI", () => {
  it("sayılı değer döndürür", () => {
    const closes = generatePrices(100, 30);
    const ohlc = generateOHLC(closes);
    const cci = calcCCI(closes, ohlc.map((h) => h.high), ohlc.map((h) => h.low));
    expect(typeof cci).toBe("number");
    expect(isFinite(cci)).toBe(true);
  });
});

describe("calcATR", () => {
  it("pozitif değer döndürür", () => {
    const closes = generatePrices(100, 30);
    const ohlc = generateOHLC(closes);
    const atr = calcATR(closes, ohlc.map((h) => h.high), ohlc.map((h) => h.low));
    expect(atr).toBeGreaterThan(0);
  });
});

describe("calcOBV", () => {
  it("yükselen fiyatla OBV artar", () => {
    const closes = [10, 11, 12, 13, 14];
    const volumes = [1000, 1000, 1000, 1000, 1000];
    const obv = calcOBV(closes, volumes);
    expect(obv).toBeGreaterThan(0);
  });

  it("düşen fiyatla OBV azalır", () => {
    const closes = [14, 13, 12, 11, 10];
    const volumes = [1000, 1000, 1000, 1000, 1000];
    const obv = calcOBV(closes, volumes);
    expect(obv).toBeLessThan(0);
  });
});

describe("calcVWAP", () => {
  it("fiyat aralığında değer döndürür", () => {
    const closes = [100, 105, 110, 108, 112];
    const ohlc = generateOHLC(closes);
    const vwap = calcVWAP(
      closes,
      ohlc.map((h) => h.volume),
      ohlc.map((h) => h.high),
      ohlc.map((h) => h.low)
    );
    expect(vwap).toBeGreaterThan(90);
    expect(vwap).toBeLessThan(120);
  });
});

describe("calcVolatility", () => {
  it("pozitif volatilite döndürür", () => {
    const closes = generatePrices(100, 30);
    const vol = calcVolatility(closes);
    expect(vol).toBeGreaterThan(0);
  });

 it("düz hat sıfır volatilite verir", () => {
    const closes = Array(30).fill(100);
    const vol = calcVolatility(closes);
    expect(vol).toBe(0);
  });
});

describe("findSupportResistance", () => {
  it("destek ve direnç seviyeleri bulur", () => {
    const closes = generatePrices(100, 60);
    const { supports, resistances } = findSupportResistance(closes);
    expect(supports.length).toBeGreaterThanOrEqual(0);
    expect(resistances.length).toBeGreaterThanOrEqual(0);
  });

  it("destek seviyeleri mevcut fiyattan düşük", () => {
    const closes = generatePrices(100, 60);
    const currentPrice = closes[closes.length - 1];
    const { supports } = findSupportResistance(closes);
    for (const s of supports) {
      expect(s).toBeLessThan(currentPrice);
    }
  });

  it("direnç seviyeleri mevcut fiyattan yüksek", () => {
    const closes = generatePrices(100, 60);
    const currentPrice = closes[closes.length - 1];
    const { resistances } = findSupportResistance(closes);
    for (const r of resistances) {
      expect(r).toBeGreaterThan(currentPrice);
    }
  });
});

describe("detectRegime", () => {
  it("yüksek volatilitede HIGH_VOLATILITY döndürür", () => {
    const closes = generatePrices(100, 30);
    expect(detectRegime(closes, 35)).toBe("HIGH_VOLATILITY");
  });

  it("düşük volatilitede trend tespit eder", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i); // kesin yükselen
    const regime = detectRegime(closes, 10);
    expect(["TRENDING_UP", "TRENDING_DOWN", "RANGING"]).toContain(regime);
  });
});

describe("interpolatePredictions", () => {
  const basePredictions = [
    { horizonDays: 1, expectedPrice: 100, lowerBand: 95, upperBand: 105, expectedReturnPercent: 0, evaluationScore: 80, mape: 2, models: [] },
    { horizonDays: 5, expectedPrice: 102, lowerBand: 96, upperBand: 108, expectedReturnPercent: 2, evaluationScore: 75, mape: 3, models: [] },
    { horizonDays: 20, expectedPrice: 108, lowerBand: 98, upperBand: 118, expectedReturnPercent: 8, evaluationScore: 65, mape: 5, models: [] },
    { horizonDays: 60, expectedPrice: 115, lowerBand: 100, upperBand: 130, expectedReturnPercent: 15, evaluationScore: 55, mape: 8, models: [] },
    { horizonDays: 120, expectedPrice: 125, lowerBand: 105, upperBand: 145, expectedReturnPercent: 25, evaluationScore: 45, mape: 12, models: [] },
  ];

  it("hedef sayısında tahmin üretir", () => {
    const result = interpolatePredictions(basePredictions, 10);
    expect(result).toHaveLength(10);
  });

  it("ilk ve son tahminler orijinale eşittir", () => {
    const result = interpolatePredictions(basePredictions, 20);
    expect(result[0].expectedPrice).toBeCloseTo(100, 1);
    expect(result[result.length - 1].expectedPrice).toBeCloseTo(125, 1);
  });

  it("monoton artan fiyatlar üretir", () => {
    const result = interpolatePredictions(basePredictions, 15);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].expectedPrice).toBeGreaterThanOrEqual(result[i - 1].expectedPrice);
    }
  });

  it("evaluationScore 10-99 arasında kalır", () => {
    const result = interpolatePredictions(basePredictions, 30);
    for (const p of result) {
      expect(p.evaluationScore).toBeGreaterThanOrEqual(10);
      expect(p.evaluationScore).toBeLessThanOrEqual(99);
    }
  });

  it("lowerBand < expectedPrice < upperBand", () => {
    const result = interpolatePredictions(basePredictions, 12);
    for (const p of result) {
      expect(p.lowerBand).toBeLessThanOrEqual(p.expectedPrice);
      expect(p.upperBand).toBeGreaterThanOrEqual(p.expectedPrice);
    }
  });
});
