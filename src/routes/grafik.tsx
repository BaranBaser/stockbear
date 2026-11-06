import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import { MarketDataStatus } from "@/components/MarketDataStatus";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchStockHistory } from "@/lib/ai.functions";
import { stocks } from "@/lib/market-data";
import { useLivePrice } from "@/lib/useLivePrice";
import { z } from "zod";

const searchSchema = z.object({
  symbol: z.string().default("THYAO"),
});

export const Route = createFileRoute("/grafik")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Teknik Grafik — stockbear" },
      { name: "description", content: "TradingView tarzı interaktif mum grafiği, teknik göstergeler ve fiyat analizi." },
      { property: "og:title", content: "Teknik Grafik — stockbear" },
    ],
  }),
  component: GrafikPage,
});

function computeSMA(closes: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

function computeEMA(closes: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else if (i === period - 1) {
      ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(ema);
    } else {
      ema = closes[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

function GrafikPage() {
  const { symbol } = Route.useSearch();
  const navigate = useNavigate();
  const [range, setRange] = useState<"1mo" | "3mo" | "6mo" | "1y" | "2y">("6mo");
  const [indicators, setIndicators] = useState({
    sma20: true,
    sma50: false,
    ema12: false,
    bollinger: false,
    rsi: false,
  });
  const [searchInput, setSearchInput] = useState(symbol);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const fetchHistory = useServerFn(fetchStockHistory);

  const { data: history = [], isLoading, isError: historyError, refetch: refreshHistory } = useQuery({
    queryKey: ["stock-history", symbol, range],
    queryFn: () => fetchHistory({ data: { symbol, range } }),
    retry: false,
    staleTime: 300_000,
    throwOnError: false,
  });

  const quote = useLivePrice(symbol);
  const { price, changePercent, isLoading: priceLoading, hasData } = quote;

  const stockName = useMemo(
    () => stocks.find((s) => s.symbol === symbol)?.name || symbol,
    [symbol],
  );

  const candleData = useMemo(() => {
    return history.map((p: { date: string; open: number; high: number; low: number; close: number }) => ({
      time: Math.floor(new Date(p.date).getTime() / 1000) as unknown as number,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));
  }, [history]);

  const closes = useMemo(() => history.map((p: { close: number }) => p.close), [history]);

  const sma20Data = useMemo(() => {
    if (!indicators.sma20 || closes.length === 0) return [];
    const sma = computeSMA(closes, 20);
    return sma
      .map((v, i) => ({
        time: Math.floor(new Date(history[i].date).getTime() / 1000),
        value: v,
      }))
      .filter((p): p is { time: number; value: number } => p.value !== undefined);
  }, [closes, history, indicators.sma20]);

  const sma50Data = useMemo(() => {
    if (!indicators.sma50 || closes.length === 0) return [];
    const sma = computeSMA(closes, 50);
    return sma
      .map((v, i) => ({
        time: Math.floor(new Date(history[i].date).getTime() / 1000),
        value: v,
      }))
      .filter((p): p is { time: number; value: number } => p.value !== undefined);
  }, [closes, history, indicators.sma50]);

  const ema12Data = useMemo(() => {
    if (!indicators.ema12 || closes.length === 0) return [];
    const ema = computeEMA(closes, 12);
    return ema
      .map((v, i) => ({
        time: Math.floor(new Date(history[i].date).getTime() / 1000),
        value: v,
      }))
      .filter((p): p is { time: number; value: number } => p.value !== undefined);
  }, [closes, history, indicators.ema12]);

  const bollingerData = useMemo(() => {
    if (!indicators.bollinger || closes.length < 20) return null;
    const upper: { time: number; value: number }[] = [];
    const lower: { time: number; value: number }[] = [];
    for (let i = 19; i < closes.length; i++) {
      const slice = closes.slice(i - 19, i + 1);
      const mid = slice.reduce((a: number, b: number) => a + b, 0) / 20;
      const variance = slice.reduce((acc: number, val: number) => acc + Math.pow(val - mid, 2), 0) / 20;
      const std = Math.sqrt(variance);
      const time = Math.floor(new Date(history[i].date).getTime() / 1000);
      upper.push({ time, value: mid + 2 * std });
      lower.push({ time, value: mid - 2 * std });
    }
    return { upper, lower };
  }, [closes, history, indicators.bollinger]);

  const rsiData = useMemo(() => {
    if (!indicators.rsi || closes.length < 15) return [];
    const rsiValues: { time: number; value: number }[] = [];
    for (let i = 14; i < closes.length; i++) {
      let gains = 0;
      let losses = 0;
      for (let j = i - 13; j <= i; j++) {
        const diff = closes[j] - closes[j - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      const rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
      rsiValues.push({
        time: Math.floor(new Date(history[i].date).getTime() / 1000),
        value: rsi,
      });
    }
    return rsiValues;
  }, [closes, history, indicators.rsi]);

  useEffect(() => {
    if (!chartContainerRef.current || candleData.length === 0) return;

    let cancelled = false;

    const init = async () => {
      const { createChart, CandlestickSeries, LineSeries } = await import("lightweight-charts");

      if (cancelled || !chartContainerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: { background: { color: "#1a1a2e" }, textColor: "#94a3b8" },
        grid: { vertLines: { color: "#262637" }, horzLines: { color: "#262637" } },
        crosshair: { mode: 0 },
        timeScale: { timeVisible: false, borderColor: "#262637" },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      candleSeries.setData(candleData.map(point => ({ ...point, time: point.time as UTCTimestamp })));

      if (sma20Data.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(sma20Data.map(point => ({ ...point, time: point.time as UTCTimestamp })));
      }
      if (sma50Data.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(sma50Data.map(point => ({ ...point, time: point.time as UTCTimestamp })));
      }
      if (ema12Data.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: "#06b6d4",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(ema12Data.map(point => ({ ...point, time: point.time as UTCTimestamp })));
      }
      if (bollingerData && bollingerData.upper.length > 0) {
        const upperSeries = chart.addSeries(LineSeries, {
          color: "#ec4899",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const lowerSeries = chart.addSeries(LineSeries, {
          color: "#ec4899",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        upperSeries.setData(bollingerData.upper.map(point => ({ ...point, time: point.time as UTCTimestamp })));
        lowerSeries.setData(bollingerData.lower.map(point => ({ ...point, time: point.time as UTCTimestamp })));
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;
    };

    init();

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candleData, sma20Data, sma50Data, ema12Data, bollingerData]);

  const toggleIndicator = (key: keyof typeof indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AppShell>
      <MarketDataStatus {...quote} onRetry={() => quote.refetch()} />
      <MarketDataStatus isLoading={isLoading} isError={historyError} hasData={history.length > 0} asOf={history.at(-1)?.date} onRetry={() => refreshHistory()} label="Son mum zamanı" />
      <PageHeader
        title="Teknik Grafik"
        subtitle={`${stockName} (${symbol}) - Candlestick & İndikatörler`}
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchInput) {
                navigate({ to: "/grafik", search: { symbol: searchInput } });
              }
            }}
            placeholder="Hisse kodu girin..."
            aria-label="Hisse kodu girin"
            className="w-full bg-secondary/60 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {["THYAO", "ASELS", "GARAN", "AKBNK", "KCHOL", "EREGL"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setSearchInput(s);
                navigate({ to: "/grafik", search: { symbol: s } });
              }}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                symbol === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary border-border hover:bg-secondary/80"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="text-sm text-muted-foreground">{stockName}</div>
          <div className="text-3xl font-bold">
            {priceLoading ? "…" : hasData ? `${price.toFixed(2)} TL` : "Fiyat alınamadı"}
          </div>
        </div>
        <div
          className={`flex items-center gap-1 text-lg font-semibold ${
            changePercent >= 0
              ? "text-[color:var(--success)]"
              : "text-destructive"
          }`}
        >
          {changePercent >= 0 ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
          {changePercent >= 0 ? "+" : ""}
          {hasData ? `${changePercent.toFixed(2)}%` : "—"}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-1 bg-secondary/60 rounded-lg p-1">
          {(["1mo", "3mo", "6mo", "1y", "2y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "sma20" as const, label: "SMA 20", color: "text-[#f59e0b]" },
            { key: "sma50" as const, label: "SMA 50", color: "text-[#8b5cf6]" },
            { key: "ema12" as const, label: "EMA 12", color: "text-[#06b6d4]" },
            { key: "bollinger" as const, label: "Bollinger", color: "text-[#ec4899]" },
            { key: "rsi" as const, label: "RSI", color: "text-[#06b6d4]" },
          ].map((ind) => (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                indicators[ind.key]
                  ? `bg-secondary border-primary/40 ${ind.color}`
                  : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border p-4 overflow-hidden">
        {isLoading ? (
          <div className="h-[500px] flex items-center justify-center text-muted-foreground">
            Yükleniyor...
          </div>
        ) : candleData.length === 0 ? (
          <div className="h-[500px] flex items-center justify-center text-muted-foreground">
            Veri bulunamadı
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full" />
        )}
      </div>

      {indicators.rsi && rsiData.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="text-sm font-semibold mb-2">RSI (14)</div>
          <div className="h-[120px]">
            <div className="relative h-full">
              <div className="absolute inset-0 flex items-center" style={{ top: "30%" }}>
                <div className="w-full border-t border-dashed border-red-500/50" />
              </div>
              <div className="absolute inset-0 flex items-center" style={{ top: "70%" }}>
                <div className="w-full border-t border-dashed border-green-500/50" />
              </div>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${rsiData.length * 3} 100`}
                preserveAspectRatio="none"
              >
                <polyline
                  points={rsiData
                    .map(
                      (d: { value: number }, i: number) =>
                        `${i * 3},${100 - d.value}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
