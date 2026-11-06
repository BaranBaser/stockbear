import { MarketDataStatus } from "@/components/MarketDataStatus";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Plus, X, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchStockHistory } from "@/lib/ai.functions";
import { runSimpleTechnicalEngine } from "@/lib/ml.engine";
import { stocks } from "@/lib/market-data";
import { useLivePrice } from "@/lib/useLivePrice";

export const Route = createFileRoute("/karsilastir")({
  head: () => ({
    meta: [
      { title: "Karşılaştırmalı Analiz — stockbear" },
      { name: "description", content: "2-4 hisseyi yan yana karşılaştırın." },
      { property: "og:title", content: "Karşılaştırmalı Analiz — stockbear" },
    ],
  }),
  component: KarsilastirPage,
});

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b"];

function StockRow({ symbol, index, history }: { symbol: string; index: number; history: Array<{ close: number; high: number; low: number; volume: number }> }) {
  const quote = useLivePrice(symbol);
  const { price, changePercent, hasData } = quote;

  const analysis = useMemo(() => {
    if (history.length < 50) return null;
    return runSimpleTechnicalEngine(history, symbol);
  }, [history, symbol]);

  const returns = useMemo(() => {
    if (history.length < 2) return { daily: 0, weekly: 0, monthly: 0 };
    const latest = history[history.length - 1].close;
    const d1 = history[history.length - 2]?.close || latest;
    const w1 = history[Math.max(0, history.length - 5)]?.close || latest;
    const m1 = history[Math.max(0, history.length - 22)]?.close || latest;
    return {
      daily: ((latest - d1) / d1) * 100,
      weekly: ((latest - w1) / w1) * 100,
      monthly: ((latest - m1) / m1) * 100,
    };
  }, [history]);

  const stockName = stocks.find((s) => s.symbol === symbol)?.name || symbol;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <MarketDataStatus {...quote} onRetry={() => quote.refetch()} />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{stockName}</div>
          <div className="text-xl font-bold">{hasData ? `${price.toFixed(2)} TL` : "Fiyat alınamadı"}</div>
          <div
            className={`text-sm font-medium ${
              changePercent >= 0
                ? "text-[color:var(--success)]"
                : "text-destructive"
            }`}
          >
            {changePercent >= 0 ? "+" : ""}
            {hasData ? `${changePercent.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
          style={{ backgroundColor: COLORS[index] }}
        >
          {symbol.charAt(0)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-secondary/40">
          <div className="text-[10px] text-muted-foreground">Günlük</div>
          <div
            className={`text-xs font-semibold ${
              returns.daily >= 0
                ? "text-[color:var(--success)]"
                : "text-destructive"
            }`}
          >
            {returns.daily >= 0 ? "+" : ""}
            {returns.daily.toFixed(2)}%
          </div>
        </div>
        <div className="p-2 rounded-lg bg-secondary/40">
          <div className="text-[10px] text-muted-foreground">Haftalık</div>
          <div
            className={`text-xs font-semibold ${
              returns.weekly >= 0
                ? "text-[color:var(--success)]"
                : "text-destructive"
            }`}
          >
            {returns.weekly >= 0 ? "+" : ""}
            {returns.weekly.toFixed(2)}%
          </div>
        </div>
        <div className="p-2 rounded-lg bg-secondary/40">
          <div className="text-[10px] text-muted-foreground">Aylık</div>
          <div
            className={`text-xs font-semibold ${
              returns.monthly >= 0
                ? "text-[color:var(--success)]"
                : "text-destructive"
            }`}
          >
            {returns.monthly >= 0 ? "+" : ""}
            {returns.monthly.toFixed(2)}%
          </div>
        </div>
      </div>
      {analysis && (
        <div className="text-xs text-center px-3 py-1.5 rounded-lg bg-secondary/60 font-medium">
          {analysis.decision === "AL"
            ? "🟢 AL"
            : analysis.decision === "SAT"
              ? "🔴 SAT"
              : "🟡 BEKLE"}{" "}
          — {analysis.rawScore} puan
        </div>
      )}
    </div>
  );
}

function KarsilastirPage() {
  const [symbols, setSymbols] = useState<string[]>(["THYAO", "ASELS", "GARAN"]);
  const [newSymbol, setNewSymbol] = useState("");

  const addSymbol = () => {
    const s = newSymbol.toUpperCase();
    if (s && !symbols.includes(s) && symbols.length < 4) {
      setSymbols([...symbols, s]);
      setNewSymbol("");
    }
  };

  const removeSymbol = (s: string) => {
    setSymbols(symbols.filter((x) => x !== s));
  };

  const fetchHistory = useServerFn(fetchStockHistory);

  const queryFn = useCallback(async (s: string) => {
    try {
      const r = await fetchHistory({ data: { symbol: s, range: "6mo" } });
      return r ?? [];
    } catch (e) { console.warn("fetchComparisonHistory error:", e);
      return [];
    }
  }, [fetchHistory]);

  const { data: hist0 = [], isLoading: loading0 } = useQuery({ queryKey: ["stock-history", symbols[0], "6mo"], queryFn: () => queryFn(symbols[0]), staleTime: 300_000, throwOnError: false, enabled: symbols.length > 0 });
  const { data: hist1 = [], isLoading: loading1 } = useQuery({ queryKey: ["stock-history", symbols[1], "6mo"], queryFn: () => queryFn(symbols[1]), staleTime: 300_000, throwOnError: false, enabled: symbols.length > 1 });
  const { data: hist2 = [], isLoading: loading2 } = useQuery({ queryKey: ["stock-history", symbols[2], "6mo"], queryFn: () => queryFn(symbols[2]), staleTime: 300_000, throwOnError: false, enabled: symbols.length > 2 });
  const { data: hist3 = [], isLoading: loading3 } = useQuery({ queryKey: ["stock-history", symbols[3], "6mo"], queryFn: () => queryFn(symbols[3]), staleTime: 300_000, throwOnError: false, enabled: symbols.length > 3 });
  const allHistories = [hist0, hist1, hist2, hist3];
  const histories = allHistories.slice(0, symbols.length);
  const historiesLoading = [loading0, loading1, loading2, loading3].slice(0, symbols.length).some(Boolean);

  const radarData = useMemo(() => {
    const metrics = ["Getiri (Aylık)", "Volatilite", "RSI", "Hacim", "Trend Gücü"];
    return metrics.map((metric) => {
      const entry: Record<string, string> = { metric };
      symbols.forEach((s, i) => {
        const h = histories[i];
        if (h.length < 2) {
          entry[s] = "0";
          return;
        }
        const closes = h.map((p: { close: number }) => p.close);
        const latest = closes[closes.length - 1];
        const m22 = closes[Math.max(0, closes.length - 22)] || latest;
        const monthlyReturn = ((latest - m22) / m22) * 100;
        const vol =
          Math.sqrt(
            closes.reduce((acc: number, c: number, idx: number) => {
              if (idx === 0) return 0;
              const r = Math.log(c / closes[idx - 1]);
              return acc + r * r;
            }, 0) /
              (closes.length - 1),
          ) * 100;

        let rsi = 50;
        if (h.length >= 15) {
          let gains = 0;
          let losses = 0;
          for (let j = h.length - 14; j < h.length; j++) {
            const diff = closes[j] - closes[j - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
          }
          rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
        }

        switch (metric) {
          case "Getiri (Aylık)":
            entry[s] = Math.max(0, Math.min(100, monthlyReturn + 50)).toFixed(0);
            break;
          case "Volatilite":
            entry[s] = Math.min(100, vol * 5).toFixed(0);
            break;
          case "RSI":
            entry[s] = rsi.toFixed(0);
            break;
          case "Hacim": {
            const volumes = h.map((p: { volume?: number }) => p.volume ?? 0);
            const avgVolume = volumes.length > 0 ? volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length : 0;
            const maxVolume = Math.max(...volumes, 1);
            entry[s] = Math.min(100, Math.round((avgVolume / maxVolume) * 100)).toFixed(0);
            break;
          }
          case "Trend Gücü":
            entry[s] = String(Math.floor(Math.abs(monthlyReturn) * 3 + 20));
            break;
        }
      });
      return entry;
    });
  }, [symbols, histories]);

  return (
    <AppShell>
      <PageHeader
        title="Karşılaştırmalı Analiz"
        subtitle="2-4 hisseyi karşılaştırın"
      />

      <div className="flex flex-wrap gap-2 items-center">
        {symbols.map((s) => (
          <div
            key={s}
            className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            {s}
            {symbols.length > 2 && (
              <button
                onClick={() => removeSymbol(s)}
                className="hover:text-destructive"
                aria-label={`${s} hissesini karşılaştırmadan kaldır`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {symbols.length < 4 && (
          <div className="flex gap-1">
            <input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSymbol()}
              placeholder="Hisse kodu"
              className="w-28 bg-secondary/60 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={addSymbol}
              aria-label="Hisse ekle"
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {historiesLoading && (
          <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
            <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" />
            Veriler yükleniyor...
          </div>
        )}
        {symbols.map((s, i) => (
          <StockRow key={s} symbol={s} index={i} history={histories[i] || []} />
        ))}
      </div>

      <div className="rounded-xl bg-card border border-border p-6">
        <h3 className="text-lg font-semibold mb-4">Radar Karşılaştırma</h3>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
            />
            <PolarRadiusAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              domain={[0, 100]}
            />
            {symbols.map((s, i) => (
              <Radar
                key={s}
                name={s}
                dataKey={s}
                stroke={COLORS[i]}
                fill={COLORS[i]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium">
                Metrik
              </th>
              {symbols.map((s) => (
                <th
                  key={s}
                  className="text-right p-3 text-muted-foreground font-medium"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {radarData.map((row) => (
              <tr
                key={row.metric}
                className="border-b border-border/50 hover:bg-secondary/30"
              >
                <td className="p-3 font-medium">{row.metric}</td>
                {symbols.map((s) => (
                  <td key={s} className="p-3 text-right">
                    {row[s]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
