import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchSingleAiAnalysis, fetchTechnicalSignals, fetchStockHistory, fetchKronosPrediction } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { stocks } from "@/lib/market-data";
import { BIST_SYMBOLS, GLOBAL_SYMBOLS } from "@/lib/ai.functions";
import { AiAnalysisResult } from "@/components/AiAnalysisResult";
import { runWalkForwardBacktest } from "@/lib/backtest";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function BacktestSection({ symbol }: { symbol: string }) {
  const fetchHistory = useServerFn(fetchStockHistory);
  const { data: historyData, isLoading: historyLoading, isError: historyError, refetch: refreshHistory } = useQuery({
    queryKey: ["backtest-history", symbol],
    queryFn: () => fetchHistory({ data: { symbol, range: "1y" } }),
    staleTime: 300_000, retry: false,
  });
  const { data: result, isLoading: engineLoading, isError: engineError, refetch: refreshBacktest } = useQuery({
    queryKey: ["backtest-walkforward", symbol, historyData],
    queryFn: () => runWalkForwardBacktest(historyData!, symbol),
    enabled: !!historyData && historyData.length >= 56,
    staleTime: 300_000, retry: false,
  });
  const chartData = useMemo(() => result?.points.map(point => ({
    date: new Date(point.date).toLocaleDateString("tr-TR", { month: "short", day: "numeric", timeZone: "Europe/Istanbul" }),
    actual: point.actualAtHorizon, predicted: point.predicted,
  })) ?? [], [result]);
  const loading = historyLoading || engineLoading;
  return (
    <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Geçmiş Veride Tahmin Testi</h2>
      <p className="text-xs text-muted-foreground mb-4">Her tahminde yalnızca o tarihe kadar bilinen mumlar kullanılır. 5 işlem gününü kapsayan, çakışmayan dönemlerde yükseliş tahmininde ertesi seans açılışında alım; diğer durumda nakitte bekleme varsayılır. Sonuçlar komisyon, kayma, vergi ve temettü öncesidir.</p>
      {loading ? <p className="text-sm text-muted-foreground animate-pulse">Geçmiş tahminler hesaplanıyor…</p>
        : historyError || engineError ? <div role="alert" className="text-sm text-destructive">Backtest hesaplanamadı. <button className="underline" onClick={() => historyError ? refreshHistory() : refreshBacktest()}>Tekrar dene</button></div>
        : !result ? <p className="text-sm text-muted-foreground">En az 56 geçerli günlük mum gerekir.</p>
        : <>
          <p className="text-xs text-muted-foreground mb-3">{result.points.length} test dönemi · {result.trades} alım · {new Date(result.startDate).toLocaleDateString("tr-TR")} – {new Date(result.endDate).toLocaleDateString("tr-TR")}. Grafikte tahminler hedef günün gerçek fiyatıyla eşleştirilir.</p>
          <div className="h-[300px] mb-6"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} /><Legend />
            <Line type="linear" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="Hedef Gün Kapanışı" />
            <Line type="linear" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" name="5 İşlem Günü Tahmini" />
          </LineChart></ResponsiveContainer></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Yön doğruluğu", value: result.directionAccuracy },
              { label: "Ortalama mutlak yüzde hata (MAPE)", value: result.mape },
              { label: "Strateji getirisi (masraf öncesi)", value: result.strategyReturn },
              { label: "Aynı dönemde al-tut getirisi", value: result.buyHoldReturn },
            ].map(metric => <div key={metric.label} className="rounded-lg border border-border bg-secondary/40 p-4"><div className="text-xs text-muted-foreground">{metric.label}</div><div className="text-xl font-bold mt-1">{metric.value.toFixed(2)}%</div></div>)}
          </div>
        </>}
    </div>
  );
}

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Karar Motoru — stockbear" },
      { name: "description", content: "Makine öğrenmesi ile hisse analizi, fiyat tahmini ve alım-satım sinyalleri." },
      { property: "og:title", content: "AI Karar Motoru — stockbear" },
      { property: "og:description", content: "Makine öğrenmesi ile hisse analizi, fiyat tahmini ve alım-satım sinyalleri." },
    ],
  }),
  component: AIEnginePage,
});

function AIEnginePage() {
  const [selectedSymbol, setSelectedSymbol] = useState("THYAO");
  const [shareCount, setShareCount] = useState(1);
  const [kronosDays, setKronosDays] = useState(14);
  const fetchAi = useServerFn(fetchSingleAiAnalysis);
  const fetchTopAi = useServerFn(fetchTechnicalSignals);
  const fetchKronos = useServerFn(fetchKronosPrediction);

  const { data: topAiData, isLoading: topLoading, isError: topError } = useQuery({
    queryKey: ["ai-top-analysis"],
    queryFn: async () => {
      return fetchTopAi();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: aiData, isLoading, isError: analysisError, refetch: refreshAnalysis } = useQuery({
    queryKey: ["ai-analysis", selectedSymbol],
    queryFn: async () => {
      return fetchAi({ data: { symbol: selectedSymbol } });
    },
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
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Combine popular stocks with all available symbols so nothing is missing
  const allSymbols = Array.from(new Set([
    ...stocks.map(s => s.symbol),
    ...BIST_SYMBOLS,
    ...GLOBAL_SYMBOLS
  ])).sort();

  // Helper to get name
  const getSymbolName = (sym: string) => {
    const s = stocks.find(x => x.symbol === sym);
    return s ? `${sym} - ${s.name}` : sym;
  };

  return (
    <AppShell>
      <PageHeader
        title="AI Karar Motoru"
        subtitle="Geçmiş fiyat verisine dayalı deneysel tahminler ve aynı dönem için karşılaştırmalı backtest sonuçları."
      />

      <div className="flex flex-col gap-6">
        
        {/* TOP AI TABLE */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> AI Sinyal Fırsat Tablosu
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Piyasadaki popüler hisselerin basit teknik indikatörler (RSI, Trend, Destek/Direnç) bazında günlük taraması. Yalnızca AL veya SAT konumunda olan fırsatlar listelenmektedir.</p>
          {topError && <p role="alert" className="text-destructive text-sm">Sinyal verisi yenilenemedi. Önceki sonuçlar varsa güncel olmayabilir.</p>}
          {topLoading ? (
             <div className="text-muted-foreground animate-pulse text-sm">Yapay zeka tüm piyasayı (100+ hisse) tarıyor... (5-10 saniye sürebilir)</div>
          ) : !topAiData || topAiData.length === 0 ? (
             <div className="text-muted-foreground text-sm">Şu an teknik olarak belirgin bir AL veya SAT sinyali üreten hisse bulunamadı.</div>
          ) : (
             <div className="overflow-x-auto max-h-[400px]">
               <table className="w-full text-left text-sm">
                 <thead className="sticky top-0 bg-card z-10 shadow-sm">
                   <tr className="border-b border-border text-muted-foreground">
                     <th className="pb-3 pr-4 font-semibold">Hisse</th>
                     <th className="pb-3 pr-4 font-semibold">Durum</th>
                     <th className="pb-3 pr-4 font-semibold">Teknik Puan</th>
                     <th className="pb-3 pr-4 font-semibold text-right">Fiyat</th>
                   </tr>
                 </thead>
                 <tbody>
                    {topAiData?.map((item: { symbol: string; currency: string; analysis: { decision: string; rawScore: number; currentPrice: number } }) => (
                     <tr key={item.symbol} className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => setSelectedSymbol(item.symbol)}>
                       <td className="py-3 pr-4 font-bold">{item.symbol}</td>
                       <td className="py-3 pr-4 font-bold">
                         <span className={`px-2 py-1 rounded text-xs ${item.analysis.decision === 'AL' ? 'bg-[color:var(--success)]/10 text-[color:var(--success)]' : 'bg-destructive/10 text-destructive'}`}>
                           {item.analysis.decision}
                         </span>
                       </td>
                       <td className="py-3 pr-4">
                         {item.analysis.rawScore.toFixed(0)} Puan
                       </td>
                       <td className="py-3 pr-4 text-right">{item.analysis.currentPrice.toFixed(2)} {item.currency}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>

        {/* HİSSE SEÇİMİ VE ZAMAN DİLİMİ */}
        <div className="bg-card border border-border p-5 rounded-xl flex flex-col md:flex-row gap-6 md:items-end">
          <div className="flex-1">
            <label className="text-sm font-semibold mb-2 block text-muted-foreground">Analiz Edilecek Hisse / Fon Seçin:</label>
            <select 
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-primary/60 transition-colors cursor-pointer"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              {allSymbols.map(sym => (
                <option key={sym} value={sym}>{getSymbolName(sym)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-semibold mb-2 block text-muted-foreground flex justify-between items-center">
              <span>Portföydeki Hisse / Fon Adedi:</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="1"
                  className="w-24 bg-background border border-border rounded px-3 py-1 text-right font-bold focus:outline-none focus:border-primary/60 transition-colors"
                  value={shareCount}
                  onChange={(e) => setShareCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <span className="text-primary font-bold">Adet</span>
              </div>
            </label>
            <input 
              type="range" 
              min="1" 
              max="5000" 
              step="1" 
              value={shareCount} 
              onChange={(e) => setShareCount(parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary mt-3"
            />
            <div className="text-xs text-muted-foreground mt-3">Tüm olası kâr/zarar ve projeksiyonlar elinizdeki bu adede göre hesaplanır.</div>
          </div>
        </div>

        {/* ANALİZ SONUÇLARI */}
        {analysisError && <p role="alert" className="text-sm text-destructive">Analiz verisi alınamadı veya yeterli geçerli mum bulunamadı. <button className="underline" onClick={() => refreshAnalysis()}>Tekrar dene</button></p>}
        <AiAnalysisResult
          analysis={aiData?.analysis || null}
          shareCount={shareCount}
          isLoading={isLoading}
          kronosPredictions={kronosData || []}
          kronosLoading={kronosLoading}
          kronosError={kronosError instanceof Error ? kronosError.message : undefined}
          kronosDays={kronosDays}
          onKronosDaysChange={setKronosDays}
        />

        {/* BACKTEST SECTION */}
        <BacktestSection symbol={selectedSymbol} />
      </div>
    </AppShell>
  );
}
