import { MarketDataStatus } from "@/components/MarketDataStatus";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FileImage, FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchStockHistory } from "@/lib/ai.functions";
import { runAIEngine, findSupportResistance, type EngineResult } from "@/lib/ml.engine";
import { stocks, SECTOR_MAP } from "@/lib/market-data";
import { useLivePrice } from "@/lib/useLivePrice";

export const Route = createFileRoute("/rapor")({
  head: () => ({
    meta: [
      { title: "Rapor Üretici — stockbear" },
      { name: "description", content: "Hisse analiz raporları oluşturun, PNG veya PDF olarak indirin." },
      { property: "og:title", content: "Rapor Üretici — stockbear" },
    ],
  }),
  component: RaporPage,
});

function RaporPage() {
  const [symbol, setSymbol] = useState("THYAO");
  const reportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const quote = useLivePrice(symbol);
  const { price, changePercent, isLoading: priceLoading, hasData } = quote;
  const fetchHistory = useServerFn(fetchStockHistory);

  const { data: history = [], isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ["stock-history", symbol, "6mo"],
    queryFn: () => fetchHistory({ data: { symbol, range: "6mo" } }),
    retry: false,
    staleTime: 300_000,
    throwOnError: false,
  });

  const [analysis, setAnalysis] = useState<EngineResult | null>(null);

  const isLoading = priceLoading || historyLoading;

  useEffect(() => {
    if (history.length < 50) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    runAIEngine(history, symbol, 252, quote.data?.currency)
      .then((r) => { if (!cancelled) setAnalysis(r); })
      .catch(() => { if (!cancelled) setAnalysis(null); });
    return () => { cancelled = true; };
  }, [history, symbol, quote.data?.currency]);

  const stockName = useMemo(
    () => stocks.find((s) => s.symbol === symbol)?.name || symbol,
    [symbol],
  );

  const sector = useMemo(() => {
    return SECTOR_MAP[symbol] || "Diğer";
  }, [symbol]);

  const priceHistory = useMemo(() => {
    return history.map((p: { close: number }) => p.close);
  }, [history]);

  const supportResistance = useMemo(() => {
    if (history.length < 10) return { supports: [], resistances: [] };
    const closes = history.map((p: { close: number }) => p.close);
    return findSupportResistance(closes);
  }, [history]);

  const generatePNG = async () => {
    if (!reportRef.current || !hasData || quote.isError || historyError || history.length < 50) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `stockbear-${symbol}-${new Date().toISOString().split("T")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      toast.error("PNG oluşturulurken hata oluştu.");
    }
    setGenerating(false);
  };

  const generatePDF = async () => {
    if (!reportRef.current || !hasData || quote.isError || historyError || history.length < 50) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `stockbear-${symbol}-${new Date().toISOString().split("T")[0]}.pdf`,
      );
    } catch (err) {
      console.error(err);
      toast.error("PDF oluşturulurken hata oluştu.");
    }
    setGenerating(false);
  };

  return (
    <AppShell>
      <MarketDataStatus {...quote} onRetry={() => quote.refetch()} />
      <PageHeader
        title="Rapor Üretici"
        subtitle="Profesyonel analiz raporları oluşturun ve indirin"
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-secondary/60 rounded-lg p-1">
          {["THYAO", "ASELS", "GARAN", "AKBNK", "KCHOL"].map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${symbol === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={generatePNG}
          disabled={generating || isLoading || !hasData || quote.isError || historyError || history.length < 50}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileImage className="w-4 h-4" />
          )}
          PNG İndir
        </button>
        <button
          onClick={generatePDF}
          disabled={generating || isLoading || !hasData || quote.isError || historyError || history.length < 50}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          PDF İndir
        </button>
      </div>

      {!hasData || historyError ? (<p className="p-6 text-muted-foreground">Rapor için geçerli fiyat ve geçmiş verisi gereklidir.</p>) : isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Rapor
          hazırlanıyor...
        </div>
      ) : !analysis ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <AlertCircle className="w-6 h-6 mr-2" /> Yeterli veri yok
        </div>
      ) : (
        <div
          ref={reportRef}
          className="rounded-xl overflow-hidden"
          style={{ background: "#0f172a" }}
        >
          {/* Header */}
          <div
            className="p-8 border-b border-white/10"
            style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-400 font-semibold tracking-widest uppercase">
                  stockbear Rapor
                </div>
                <div className="text-3xl font-bold text-white mt-1">
                  {stockName} ({symbol})
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  {sector} •{" "}
                  {new Date().toLocaleDateString("tr-TR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white">
                  {price.toFixed(2)} TL
                </div>
                <div
                  className={`text-lg font-semibold ${changePercent >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {changePercent >= 0 ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* AI Signal */}
          <div className="p-8 border-b border-white/10">
            <div className="text-xs text-slate-400 font-semibold tracking-widest uppercase mb-4">
              AI Karar Motoru
            </div>
            <div className="flex items-center gap-8">
              <div
                className={`text-5xl font-black ${analysis.decision === "AL" ? "text-green-400" : analysis.decision === "SAT" ? "text-red-400" : "text-yellow-400"}`}
              >
                {analysis.decision}
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-slate-400">Teknik puan</div>
                    <div className="text-xl font-bold text-white">
                      {analysis.signalScore.toFixed(0)} / 100
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-slate-400">Hedef (20g)</div>
                    <div className="text-xl font-bold text-white">
                      {analysis.predictions
                        .find((p) => p.horizonDays === 20)
                        ?.expectedPrice.toFixed(2) || "N/A"}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-slate-400">Getiri</div>
                    <div
                      className={`text-xl font-bold ${(analysis.predictions.find((p) => p.horizonDays === 20)?.expectedReturnPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {(() => {
                        const pct = analysis.predictions.find(
                          (p) => p.horizonDays === 20,
                        )?.expectedReturnPercent;
                        return pct !== undefined
                          ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
                          : "N/A";
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price chart */}
          <div className="p-8 border-b border-white/10">
            <div className="text-xs text-slate-400 font-semibold tracking-widest uppercase mb-4">
              Son 6 Ay Fiyat Grafiği
            </div>
            <svg
              width="100%"
              height="120"
              viewBox={`0 0 ${priceHistory.length * 3} 120`}
              preserveAspectRatio="none"
            >
              <polyline
                points={priceHistory
                  .map((v: number, i: number) => {
                    const min = Math.min(...priceHistory);
                    const max = Math.max(...priceHistory);
                    const range = max - min || 1;
                    return `${i * 3},${120 - ((v - min) / range) * 100}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={changePercent >= 0 ? "#22c55e" : "#ef4444"}
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Support/Resistance */}
          <div className="p-8 border-b border-white/10">
            <div className="text-xs text-slate-400 font-semibold tracking-widest uppercase mb-4">
              Temel Seviyeler
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {supportResistance.supports.map((s: number, i: number) => (
                <div
                  key={`s${i}`}
                  className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                >
                  <div className="text-xs text-green-400">Destek {i + 1}</div>
                  <div className="text-lg font-bold text-white">
                    {s.toFixed(2)}
                  </div>
                </div>
              ))}
              {supportResistance.resistances.map(
                (r: number, i: number) => (
                  <div
                    key={`r${i}`}
                    className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <div className="text-xs text-red-400">
                      Direnç {i + 1}
                    </div>
                    <div className="text-lg font-bold text-white">
                      {r.toFixed(2)}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Technicals */}
          <div className="p-8 border-b border-white/10">
            <div className="text-xs text-slate-400 font-semibold tracking-widest uppercase mb-4">
              Teknik İndikatörler
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-slate-400">RSI (14)</div>
                <div className="text-lg font-bold text-white">
                  {analysis.indicators.rsi.toFixed(1)}
                </div>
                <div
                  className={`text-xs font-medium ${analysis.indicators.rsi > 70 ? "text-red-400" : analysis.indicators.rsi < 30 ? "text-green-400" : "text-slate-400"}`}
                >
                  {analysis.indicators.rsi > 70
                    ? "Aşırı Alım"
                    : analysis.indicators.rsi < 30
                      ? "Aşırı Satım"
                      : "Nötr"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-slate-400">MACD</div>
                <div
                  className={`text-lg font-bold ${analysis.indicators.macd > analysis.indicators.macdSignal ? "text-green-400" : "text-red-400"}`}
                >
                  {analysis.indicators.macd.toFixed(2)}
                </div>
                <div className="text-xs text-slate-400">
                  {analysis.indicators.macd > analysis.indicators.macdSignal
                    ? "Yükseliş"
                    : "Düşüş"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-slate-400">SMA 20</div>
                <div className="text-lg font-bold text-white">
                  {analysis.indicators.sma20.toFixed(2)}
                </div>
                <div
                  className={`text-xs font-medium ${price > analysis.indicators.sma20 ? "text-green-400" : "text-red-400"}`}
                >
                  {price > analysis.indicators.sma20 ? "Üzerinde" : "Altında"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-slate-400">Volatilite</div>
                <div className="text-lg font-bold text-white">
                  {analysis.volatility.toFixed(1)}%
                </div>
                <div
                  className={`text-xs font-medium ${analysis.volatility > 25 ? "text-yellow-400" : "text-green-400"}`}
                >
                  {analysis.volatility > 25 ? "Yüksek" : "Normal"}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 text-center" style={{ background: "#1e293b" }}>
            <div className="text-xs text-slate-500">
              Bu rapor stockbear AI tarafından otomatik olarak oluşturulmuştur.
              Yatırım tavsiyesi değildir.
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Oluşturulma: {new Date().toLocaleString("tr-TR")}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
