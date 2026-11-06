import { MarketDataStatus } from "@/components/MarketDataStatus";
import { useBistData } from "@/lib/useBistData";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, Sparkline } from "@/components/AppShell";
import { stocks, findStock, SECTOR_MAP } from "@/lib/market-data";
import { useServerFn } from "@tanstack/react-start";
import { fetchSingleStock, fetchStockHistory, fetchSingleAiAnalysis, fetchKronosPrediction } from "@/lib/ai.functions";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Star, RefreshCw, BarChart3, Activity, Clock, Target, Zap, Search, Brain } from "lucide-react";
import { useWatchlist } from "@/lib/storage";
import { z } from "zod";
import { useMemo, useState } from "react";
import { calcRSI, calcSMA, calcEMA, calcBollinger, calcMACD, findSupportResistance, calcStochastic, calcADX, calcCCI, calcATR, calcOBV, calcVWAP, calcVolatility, detectRegime } from "@/lib/ml.engine";
import { AiAnalysisResult } from "@/components/AiAnalysisResult";

export const Route = createFileRoute("/analiz")({
  validateSearch: z.object({ symbol: z.string().optional() }),
  component: AnalizPage,
});

function AnalizPage() {
  const { symbol } = Route.useSearch();
  const selectedSymbol = (symbol || "THYAO").toUpperCase();
  const staticStock = findStock(selectedSymbol);
  const watch = useWatchlist();
  const [timeRange, setTimeRange] = useState("1mo");

  const fetchSingle = useServerFn(fetchSingleStock);
  const fetchHistory = useServerFn(fetchStockHistory);

  const fetchAi = useServerFn(fetchSingleAiAnalysis);
  const fetchKronos = useServerFn(fetchKronosPrediction);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [shareCount, setShareCount] = useState(1);
  const [kronosDays, setKronosDays] = useState(14);

  const { data: liveStock, isLoading: loadingLive, isError: priceError, isFetching: priceFetching, refetch: refreshPrice } = useQuery({
    queryKey: ["stock-live", selectedSymbol],
    queryFn: () => fetchSingle({ data: { symbol: selectedSymbol } }),
    retry: false,
    refetchInterval: 120_000,
    staleTime: 60_000,
    throwOnError: false,
  });

  const { data: history = [], isLoading: historyLoading, isError: historyError, refetch: refreshHistory } = useQuery({
    queryKey: ["stock-history", selectedSymbol, timeRange],
    queryFn: () => fetchHistory({ data: { symbol: selectedSymbol, range: timeRange } }),
    retry: false,
    staleTime: 300_000,
    throwOnError: false,
  });

  const market = useBistData();
  const liveData = market.stocks;

  const { data: aiData, isLoading: loadingAi, isError: analysisError, refetch: refreshAnalysis } = useQuery({
    queryKey: ["ai-analysis", selectedSymbol],
    queryFn: async () => {
      return fetchAi({ data: { symbol: selectedSymbol } });
    },
    enabled: showAiAnalysis,
    staleTime: 5 * 60 * 1000,
  });

  const { data: kronosData, isLoading: kronosLoading, error: kronosError } = useQuery({
    queryKey: ["kronos-analysis", selectedSymbol, kronosDays],
    queryFn: async () => {
      try {
        const res = await fetchKronos({ data: { symbol: selectedSymbol, predDays: kronosDays } });
        if (res.error) throw new Error(res.error);
        return res.predictions;
      } catch (e) {
        console.warn("fetchKronos error:", e);
        throw e;
      }
    },
    enabled: showAiAnalysis,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const popularStocks = useMemo(() => {
    const source = liveData;
    return source.length ? [...source].sort((a, b) => b.volume - a.volume).slice(0, 15) : stocks.slice(0, 15);
  }, [liveData]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return stocks.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [searchQuery]);

  const stock = {
    symbol: selectedSymbol, name: liveStock?.name ?? staticStock?.name ?? selectedSymbol,
    sector: SECTOR_MAP[selectedSymbol] || staticStock?.sector || "Diğer", price: liveStock?.price ?? 0,
    change: liveStock?.changePercent ?? 0, volume: liveStock?.volume ?? 0,
    high52: liveStock?.high52 ?? 0, low52: liveStock?.low52 ?? 0, pe: 0, marketCap: 0,
  };

  // Gerçek teknik hesaplamalar
  const technicals = useMemo(() => {
    if (history.length < 50) return null;
    const closes = history.map((h) => h.close).filter(Boolean) as number[];
    const highs = history.map((h) => h.high ?? h.close * 1.01).filter(Boolean) as number[];
    const lows = history.map((h) => h.low ?? h.close * 0.99).filter(Boolean) as number[];
    const volumes = history.map((h) => h.volume ?? 0) as number[];
    if (closes.length < 5) return null;

    const rsi = calcRSI(closes);
    const macd = calcMACD(closes);
    const bollinger = calcBollinger(closes);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const { supports, resistances } = findSupportResistance(closes);
    const stochastic = calcStochastic(closes, highs, lows, 14, 3);
    const adx = calcADX(closes, highs, lows, 14);
    const cci = calcCCI(closes, highs, lows, 20);
    const atr = calcATR(closes, highs, lows, 14);
    const obv = calcOBV(closes, volumes);
    const vwap = calcVWAP(closes, volumes, highs, lows);

    const price = closes[closes.length - 1];
    const priceChange5d = closes.length >= 5 && closes[closes.length - 5] !== 0 ? ((price - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
    const priceChange1m = closes.length >= 20 && closes[closes.length - 20] !== 0 ? ((price - closes[closes.length - 20]) / closes[closes.length - 20]) * 100 : 0;
    const volatility = calcVolatility(closes);
    const regime = detectRegime(closes, volatility);

    // Sinyal hesaplama
    const rsiSignal = rsi < 30 ? "AL" : rsi > 70 ? "SAT" : "NÖTR";
    const macdSignal = macd.hist > 0 ? "AL" : "SAT";
    const bollingerSignal = price < bollinger.lower ? "AL" : price > bollinger.upper ? "SAT" : "NÖTR";
    const trendSignal = sma20 > sma50 ? "YÜKSELEN" : "DÜŞEN";
    const stochasticSignal = stochastic.k < 20 ? "AL" : stochastic.k > 80 ? "SAT" : "NÖTR";
    const adxSignal = adx > 25 ? "GÜÇLÜ TREND" : "ZAYIF";
    const cciSignal = cci < -100 ? "AL" : cci > 100 ? "SAT" : "NÖTR";

    // Genel sinyal
    const signals = [rsiSignal, macdSignal, bollingerSignal, stochasticSignal, cciSignal];
    const alCount = signals.filter((s) => s === "AL").length;
    const satCount = signals.filter((s) => s === "SAT").length;
    const overallSignal = alCount > satCount ? "AL" : satCount > alCount ? "SAT" : "NÖTR";

    return {
      rsi, macd, bollinger, sma20, sma50, ema12, ema26,
      stochastic, adx, cci, atr, obv, vwap,
      supports, resistances,
      priceChange5d, priceChange1m, volatility, regime,
      rsiSignal, macdSignal, bollingerSignal, trendSignal, overallSignal,
      stochasticSignal, adxSignal, cciSignal,
    };
  }, [history]);

  const color = stock.change >= 0 ? "oklch(0.72 0.19 145)" : "oklch(0.65 0.22 25)";

  const chartData = history.map(h => h.close);

  const ranges = [
    { k: "5d", l: "5G" },
    { k: "1mo", l: "1A" },
    { k: "3mo", l: "3A" },
    { k: "6mo", l: "6A" },
    { k: "1y", l: "1Y" },
    { k: "2y", l: "2Y" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Hisse Analiz"
        subtitle={`${stock.symbol} — ${stock.name}`}
        action={
          <div className="flex items-center gap-2">
            {liveStock && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[color:var(--success)] animate-pulse" />
                Sağlayıcı verisi
              </span>
            )}
            <button onClick={() => watch.toggle(stock.symbol)} className="inline-flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2 text-sm hover:border-primary/40">
              <Star className={`w-4 h-4 ${watch.has(stock.symbol) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              {watch.has(stock.symbol) ? "Takipten Çıkar" : "Takibe Al"}
            </button>
            <button 
              onClick={() => setShowAiAnalysis(!showAiAnalysis)}
              className={`inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-colors ${showAiAnalysis ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40 text-primary"}`}
            >
              <Brain className="w-4 h-4" />
              AI Analiz
            </button>
          </div>
        }
      />

      <MarketDataStatus isLoading={loadingLive} isFetching={priceFetching} isError={priceError} hasData={!!liveStock} asOf={liveStock?.asOf} onRetry={() => refreshPrice()} />
      {/* Hızlı seçim ve Arama */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2 flex-1">
          {popularStocks.map((s) => (
            <Link key={s.symbol} to="/analiz" search={{ symbol: s.symbol }} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${s.symbol === stock.symbol ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-primary/40"}`}>
              {s.symbol}
            </Link>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            aria-label="Hisse ara"
            placeholder="Hisse ara (Bulanık Arama)..."
            value={searchQuery}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/60"
          />
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
              {searchResults.map((res) => (
                <Link
                  key={res.symbol}
                  to="/analiz"
                  search={{ symbol: res.symbol }}
                  className="flex flex-col px-4 py-2 hover:bg-secondary cursor-pointer border-b border-border last:border-0"
                  onClick={() => { setSearchQuery(""); setShowSearch(false); }}
                >
                  <span className="font-semibold text-sm">{res.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate">{res.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAiAnalysis && (
        <div className="mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="rounded-xl border border-primary/40 bg-card p-6 shadow-lg shadow-primary/5">
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Yapay Zeka Karar Motoru Raporu</h2>
              </div>
              
              {/* PORTFÖY ADEDİ GİRİŞİ */}
              <div className="flex items-center gap-4 bg-secondary/30 px-4 py-2 rounded-lg border border-border">
                <label htmlFor="shareCount" className="text-sm font-semibold text-muted-foreground">Portföydeki Adet:</label>
                <div className="flex items-center gap-2">
                  <input 
                    id="shareCount"
                    type="number" 
                    min="1"
                    aria-label="Portföydeki adet"
                    className="w-20 bg-background border border-border rounded px-2 py-1 text-right text-sm font-bold focus:outline-none focus:border-primary/60"
                    value={shareCount}
                    onChange={(e) => setShareCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>
            </div>
            
            {analysisError && <p role="alert" className="text-sm text-destructive">Analiz hesaplanamadı. <button className="underline" onClick={() => refreshAnalysis()}>Tekrar dene</button></p>}
            <AiAnalysisResult
              analysis={aiData?.analysis || null}
              shareCount={shareCount}
              isLoading={loadingAi}
              kronosPredictions={kronosData || []}
              kronosLoading={kronosLoading}
              kronosError={kronosError instanceof Error ? kronosError.message : undefined}
              kronosDays={kronosDays}
              onKronosDaysChange={setKronosDays}
            />
          </div>
        </div>
      )}

      {liveStock && <div className="grid lg:grid-cols-3 gap-4">
        {/* Sol kolon — Grafik ve temel bilgiler */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground">{SECTOR_MAP[stock.symbol] || stock.sector}</div>
                <div className="text-3xl font-bold mt-1">{stock.price.toFixed(2)} <span className="text-lg text-muted-foreground">TL</span></div>
                <div className={`text-sm flex items-center gap-1 mt-1 ${stock.change >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                  {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}% bugün
                </div>
              </div>
              {loadingLive && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="flex gap-1 mb-3">
              {ranges.map((r) => (
                <button
                  key={r.k}
                  onClick={() => setTimeRange(r.k)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${timeRange === r.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  {r.l}
                </button>
              ))}
            </div>

            <MarketDataStatus isLoading={historyLoading} isError={historyError} hasData={history.length > 0} asOf={history.at(-1)?.date} onRetry={() => refreshHistory()} label="Son mum zamanı" />
            {chartData.length > 1 && <Sparkline data={chartData} color={color} height={260} width={800} />}

            {history.length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {history.length} günlük veri
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
              {[
                { l: "Hacim", v: `${(stock.volume / 1e6).toFixed(2)} Mn lot` },
                { l: "Piyasa Değeri", v: "Veri sağlanmıyor" },
                { l: "F/K Oranı", v: "Veri sağlanmıyor" },
                { l: "52H Aralığı", v: `${stock.low52} - ${stock.high52}` },
              ].map((k) => (
                <div key={k.l}><div className="text-xs text-muted-foreground">{k.l}</div><div className="text-sm font-semibold mt-1">{k.v}</div></div>
              ))}
            </div>
          </div>

          {history.length > 0 && history.length < 50 && <p className="text-sm text-muted-foreground">Teknik göstergeler için en az 50 geçerli günlük mum gerekiyor. Daha uzun bir tarih aralığı seçin.</p>}
          {/* Teknik göstergeler — gerçek hesaplamalar */}
          {technicals && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary" />
                <div className="font-semibold text-sm">Teknik Göstergeler</div>
                <div className={`ml-auto text-xs font-bold px-2 py-1 rounded ${technicals.overallSignal === "AL" ? "bg-[color:var(--success)]/20 text-[color:var(--success)]" : technicals.overallSignal === "SAT" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  GENEL: {technicals.overallSignal}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "RSI (14)", value: technicals.rsi.toFixed(1), signal: technicals.rsiSignal },
                  { name: "MACD", value: technicals.macd.hist > 0 ? `+${technicals.macd.hist.toFixed(2)}` : technicals.macd.hist.toFixed(2), signal: technicals.macdSignal },
                  { name: "Bollinger", value: stock.price < technicals.bollinger.lower ? "Alt Bant" : stock.price > technicals.bollinger.upper ? "Üst Bant" : "Orta", signal: technicals.bollingerSignal },
                  { name: "Trend (SMA)", value: technicals.trendSignal, signal: technicals.sma20 > technicals.sma50 ? "AL" : "SAT" },
                  { name: "SMA 20", value: `${technicals.sma20.toFixed(2)} TL`, signal: stock.price > technicals.sma20 ? "Üzerinde" : "Altında" },
                  { name: "SMA 50", value: `${technicals.sma50.toFixed(2)} TL`, signal: stock.price > technicals.sma50 ? "Üzerinde" : "Altında" },
                  { name: "Stochastic %K", value: technicals.stochastic.k.toFixed(1), signal: technicals.stochasticSignal },
                  { name: "ADX", value: technicals.adx.toFixed(1), signal: technicals.adxSignal },
                  { name: "CCI", value: technicals.cci.toFixed(0), signal: technicals.cciSignal },
                  { name: "Yıllık volatilite", value: `${technicals.volatility.toFixed(1)}%`, signal: technicals.volatility > 40 ? "YÜKSEK" : technicals.volatility < 20 ? "DÜŞÜK" : "NORMAL" },
                  { name: "Değişim (5G)", value: `${technicals.priceChange5d >= 0 ? "+" : ""}${technicals.priceChange5d.toFixed(2)}%`, signal: technicals.priceChange5d > 0 ? "POZİTİF" : "NEGATİF" },
                  { name: "ATR", value: `${technicals.atr.toFixed(2)} TL`, signal: technicals.atr > stock.price * 0.03 ? "YÜKSEK" : "NORMAL" },
                ].map((g) => (
                  <div key={g.name} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40">
                    <span className="text-xs text-muted-foreground">{g.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{g.value}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.signal === "AL" || g.signal === "POZİTİF" || g.signal === "Üzerinde" || g.signal === "GÜÇLÜ TREND" ? "bg-[color:var(--success)]/20 text-[color:var(--success)]" : g.signal === "SAT" || g.signal === "NEGATİF" || g.signal === "Altında" || g.signal === "YÜKSEK" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {g.signal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rejim Kartı */}
              <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/20 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Piyasa Rejimi</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  technicals.regime === "TRENDING_UP" ? "bg-[color:var(--success)]/20 text-[color:var(--success)]" :
                  technicals.regime === "TRENDING_DOWN" ? "bg-destructive/20 text-destructive" :
                  technicals.regime === "HIGH_VOLATILITY" ? "bg-orange-500/20 text-orange-500" :
                  "bg-yellow-500/20 text-yellow-500"
                }`}>
                  {technicals.regime === "TRENDING_UP" ? "↑ Yükselen Trend" :
                   technicals.regime === "TRENDING_DOWN" ? "↓ Düşen Trend" :
                   technicals.regime === "HIGH_VOLATILITY" ? "⚡ Yüksek Volatilite" : "→ Yatay"}
                </span>
              </div>
            </div>
          )}

          {/* Destek ve Direnç seviyeleri */}
          {technicals && (technicals.supports.length > 0 || technicals.resistances.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-primary" />
                <div className="font-semibold text-sm">Destek & Direnç Seviyeleri</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Direnç Seviyeleri</div>
                  <div className="space-y-1">
                    {technicals.resistances.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/10 text-xs">
                        <span className="text-destructive font-medium">R{i + 1}</span>
                        <span className="font-semibold">{r.toFixed(2)} TL</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Destek Seviyeleri</div>
                  <div className="space-y-1">
                    {technicals.supports.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-[color:var(--success)]/10 text-xs">
                        <span className="text-[color:var(--success)] font-medium">S{i + 1}</span>
                        <span className="font-semibold">{s.toFixed(2)} TL</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sağ kolon — Ek bilgiler */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <div className="font-semibold text-sm">Fiyat Bilgileri</div>
            </div>
            <div className="space-y-2">
              {[
                { l: "Günün Açılışı", v: history.length > 0 && history.at(-1)?.open != null ? `${history.at(-1)!.open.toFixed(2)} TL` : "-" },
                { l: "Gün İçi En Yüksek", v: history.length > 0 ? `${history.at(-1)!.high.toFixed(2)} TL` : "-" },
                { l: "Gün İçi En Düşük", v: history.length > 0 ? `${history.at(-1)!.low.toFixed(2)} TL` : "-" },
                { l: "52 Hafta Yüksek", v: `${stock.high52} TL` },
                { l: "52 Hafta Düşük", v: `${stock.low52} TL` },
                { l: "52H Orta Nokta", v: `${((stock.high52 + stock.low52) / 2).toFixed(2)} TL` },
                { l: "Fiyat / 52H Yüksek", v: stock.high52 > 0 ? `${((stock.price / stock.high52) * 100).toFixed(1)}%` : "—" },
              ].map((item) => (
                <div key={item.l} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.l}</span>
                  <span className="font-medium">{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sektör bilgisi */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <div className="font-semibold text-sm">Sektör Analizi</div>
            </div>
            <div className="space-y-2">
              {[
                { l: "Sektör", v: SECTOR_MAP[stock.symbol] || stock.sector },
                { l: "F/K Oranı", v: stock.pe > 0 ? `${stock.pe.toFixed(1)}` : "-" },
                { l: "Değerlendirme", v: stock.pe > 0 && stock.pe < 10 ? "Değerli" : stock.pe >= 10 && stock.pe < 20 ? "Normal" : stock.pe >= 20 ? "Pahalı" : "-" },
              ].map((item) => (
                <div key={item.l} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.l}</span>
                  <span className="font-medium">{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Uyarı */}
          <div className="rounded-xl border border-primary/30 p-5" style={{ background: "linear-gradient(135deg, oklch(0.22 0.05 82 / 0.3), oklch(0.18 0.01 260))" }}>
            <div className="text-sm font-semibold">Veri Kaynağı</div>
            <p className="text-xs text-muted-foreground mt-2">
              Fiyatlar Yahoo Finance tarafından sağlanmaktadır. Veriler gecikmeli olabilir. Teknik göstergeler gerçek fiyat verilerinden hesaplanmıştır. Yatırım tavsiyesi değildir.
            </p>
          </div>
        </div>
      </div>
      }
    </AppShell>
  );
}
