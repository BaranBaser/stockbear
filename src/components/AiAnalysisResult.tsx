import { Brain, CheckCircle2, AlertTriangle, AlertCircle, Target, Zap, Activity, Shield, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import type { EngineResult, HorizonPrediction, KronosPrediction } from "@/lib/ml.engine";

type Prediction = HorizonPrediction;
type AnalysisData = EngineResult;

interface AiAnalysisResultProps {
  analysis: AnalysisData | null;
  shareCount: number;
  isLoading?: boolean;
  kronosPredictions?: KronosPrediction[];
  kronosLoading?: boolean;
  kronosError?: string;
  kronosDays?: number;
  onKronosDaysChange?: (days: number) => void;
}

function mapHorizonToLabel(days: number) {
  const labels: Record<number, string> = {
    1: "1 Gün", 2: "2 Gün", 3: "3 Gün", 5: "1 Hafta",
    7: "1,5 Hafta", 10: "2 Hafta", 15: "3 Hafta", 20: "1 Ay",
    30: "1,5 Ay", 40: "2 Ay", 60: "3 Ay", 80: "4 Ay", 120: "6 Ay",
  };
  return labels[days] || `${days} Gün`;
}

function RegimeBadge({ regime }: { regime: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    TRENDING_UP: { label: "Yükselen Trend", cls: "bg-[color:var(--success)]/20 text-[color:var(--success)]", icon: <TrendingUp className="w-3 h-3" /> },
    TRENDING_DOWN: { label: "Düşen Trend", cls: "bg-destructive/20 text-destructive", icon: <TrendingDown className="w-3 h-3" /> },
    RANGING: { label: "Yatay Piyasa", cls: "bg-yellow-500/20 text-yellow-500", icon: <Minus className="w-3 h-3" /> },
    HIGH_VOLATILITY: { label: "Yüksek Volatilite", cls: "bg-orange-500/20 text-orange-500", icon: <Activity className="w-3 h-3" /> },
  };
  const cfg = map[regime] || map.RANGING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function DecisionCard({ decision, signalScore, currentPrice, volatility, shareCount, regime, currency }: {
  decision: string; signalScore: number; currentPrice: number; volatility: number; shareCount: number; regime: string; currency: string;
}) {
  return (
    <div className="grid md:grid-cols-4 gap-4">
      <div className={`rounded-xl p-6 flex flex-col items-center justify-center text-center border shadow-lg ${
        decision === "AL" ? "bg-[color:var(--success)]/10 border-[color:var(--success)]/30 text-[color:var(--success)] shadow-[color:var(--success)]/10" :
        decision === "SAT" ? "bg-destructive/10 border-destructive/30 text-destructive shadow-destructive/10" :
        "bg-yellow-500/10 border-yellow-500/30 text-yellow-500 shadow-yellow-500/10"
      }`}>
        <div className="text-sm font-bold tracking-widest uppercase mb-2 opacity-80">Genel Motor Kararı</div>
        <div className="text-5xl font-black flex items-center gap-3">
          {decision === "AL" ? <CheckCircle2 className="w-10 h-10" /> :
           decision === "SAT" ? <AlertTriangle className="w-10 h-10" /> :
           <AlertCircle className="w-10 h-10" />}
          {decision}
        </div>
      </div>

      <div className="rounded-xl p-6 border border-border bg-card flex flex-col items-center justify-center text-center shadow-md">
        <div className="text-sm font-bold tracking-widest uppercase mb-3 text-muted-foreground">Teknik Puan</div>
        <div className="w-full bg-secondary h-4 rounded-full max-w-[200px] overflow-hidden mb-3 relative">
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-1000" style={{ width: `${signalScore}%` }} />
        </div>
        <div className="text-3xl font-black">{signalScore.toFixed(0)} / 100</div>
        <div className="text-xs text-muted-foreground mt-2">0: SAT yönü · 100: AL yönü. Başarı olasılığı değildir.</div>
      </div>

      <div className="rounded-xl p-6 border border-border bg-card flex flex-col items-center justify-center text-center shadow-md">
        <div className="text-sm font-bold tracking-widest uppercase mb-2 text-muted-foreground">Şu Anki Toplam Değer</div>
        <div className="text-4xl font-black">{(currentPrice * shareCount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</div>
        <div className="text-sm text-muted-foreground mt-2">Birim Fiyat: {currentPrice.toFixed(2)} {currency} | Yıllık volatilite: %{volatility.toFixed(2)}</div>
      </div>

      <div className="rounded-xl p-6 border border-border bg-card flex flex-col items-center justify-center text-center shadow-md">
        <div className="text-sm font-bold tracking-widest uppercase mb-3 text-muted-foreground">Piyasa Rejimi</div>
        <RegimeBadge regime={regime} />
        <div className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {regime === "TRENDING_UP" && "Güçlü yükselen trend tespit edildi. Momentum pozitif."}
          {regime === "TRENDING_DOWN" && "Düşen trend hakim. Dikkatli olunmalı."}
          {regime === "RANGING" && "Fiyat yatay hareket ediyor. Net yön yok."}
          {regime === "HIGH_VOLATILITY" && "Fiyat oynaklığı yüksek. Risk yönetimi kritik."}
        </div>
      </div>
    </div>
  );
}

function IndicatorGauge({ label, value, min, max, unit, warnLow, warnHigh }: {
  label: string; value: number; min: number; max: number; unit?: string; warnLow?: number; warnHigh?: number;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const isWarnLow = warnLow !== undefined && value < warnLow;
  const isWarnHigh = warnHigh !== undefined && value > warnHigh;
  const barColor = isWarnLow ? "bg-[color:var(--success)]" : isWarnHigh ? "bg-destructive" : "bg-primary";
  return (
    <div className="bg-secondary/40 rounded-lg p-3 border border-border/50">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
        <span className="text-xs font-black">{value.toFixed(1)}{unit || ""}</span>
      </div>
      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RiskManagementCard({ risk, currentPrice, currency }: { currency: string; risk: AnalysisData['riskManagement']; currentPrice: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-primary" />
        <div className="font-semibold text-sm">Risk Yönetimi Önerileri</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
          <div className="text-[10px] font-bold text-destructive uppercase mb-1">Önerilen Stop-Loss</div>
          <div className="text-sm font-black text-destructive">{risk.suggestedStopLoss.toFixed(2)} {currency}</div>
          <div className="text-[10px] text-muted-foreground mt-1">-%{(((currentPrice - risk.suggestedStopLoss) / currentPrice) * 100).toFixed(1)}</div>
        </div>
        <div className="bg-[color:var(--success)]/10 rounded-lg p-3 text-center border border-[color:var(--success)]/20">
          <div className="text-[10px] font-bold text-[color:var(--success)] uppercase mb-1">Önerilen Take-Profit</div>
          <div className="text-sm font-black text-[color:var(--success)]">{risk.suggestedTakeProfit.toFixed(2)} {currency}</div>
          <div className="text-[10px] text-muted-foreground mt-1">+%{(((risk.suggestedTakeProfit - currentPrice) / currentPrice) * 100).toFixed(1)}</div>
        </div>
        <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
          <div className="text-[10px] font-bold text-primary uppercase mb-1">Önerilen Pozisyon</div>
          <div className="text-sm font-black text-primary">{risk.suggestedPositionSize === null ? "Hesaplanmıyor" : `%${risk.suggestedPositionSize.toFixed(1)}`}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Başarı oranı doğrulanmadı</div>
        </div>
        <div className="bg-secondary/40 rounded-lg p-3 text-center border border-border/50">
          <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Risk/Kazanç Oranı</div>
          <div className="text-sm font-black">{risk.riskRewardRatio.toFixed(2)}x</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {risk.riskRewardRatio >= 2 ? "İyi" : risk.riskRewardRatio >= 1 ? "Normal" : "Düşük"}
          </div>
        </div>
      </div>
    </div>
  );
}

function HorizonCard({ prediction, currentPrice, shareCount, currency }: { currency: string; prediction: Prediction; currentPrice: number; shareCount: number }) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
      <div className="p-4 bg-secondary/30 border-b border-border flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" /> {mapHorizonToLabel(prediction.horizonDays)} Gelecek Projeksiyonu
        </h3>
        <div className="text-right">
          <div className={`text-lg font-black ${prediction.expectedReturnPercent >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
            {(prediction.expectedPrice * shareCount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            <span className="text-sm ml-2">
              ({prediction.expectedReturnPercent >= 0 ? "+" : ""}{((prediction.expectedPrice - currentPrice) * shareCount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency} Kâr/Zarar)
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase mb-3">Model Hata Payları & Ağırlıklar (Geçmiş Test)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {prediction.models.map((m) => (
              <div key={m.model} className="bg-secondary/40 rounded-lg p-3 text-center border border-border/50">
                <div className="text-[10px] font-bold text-muted-foreground truncate mb-1">{m.model.replace("_", " ")}</div>
                <div className="text-sm font-semibold">{(m.prediction * shareCount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[10px]">
                  <span className="text-destructive font-medium">{m.mape === null ? "Test verisi yok" : `MAPE: %${m.mape.toFixed(1)}`}</span>
                  <span className="text-primary font-bold">Ağırlık: %{(m.weight * 100).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-background rounded-lg p-4 text-sm border border-border flex justify-between items-center">
          <div>
            <div className="text-muted-foreground text-xs mb-1">Geçmiş tahmin hatası (MAPE)</div>
            <div className="font-semibold text-destructive">{prediction.mape === null ? "Bu ufuk için test verisi yok" : `%${prediction.mape.toFixed(2)} · ${prediction.evaluationSamples ?? 0} test noktası`}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs mb-1">Sezgisel fiyat aralığı</div>
            <div className="font-semibold">{(prediction.lowerBand * shareCount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency} - {(prediction.upperBand * shareCount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectionChart({ predictions, currentPrice, shareCount }: { predictions: Prediction[]; currentPrice: number; shareCount: number }) {
  const chartData = [
    {
      name: "Şu An",
      Ensemble: currentPrice * shareCount,
      AltBant: currentPrice * shareCount,
      ÜstBant: currentPrice * shareCount,
      RidgeRegression: currentPrice * shareCount,
      MomentumExtrapolation: currentPrice * shareCount,
      MeanReversion: currentPrice * shareCount,
      EMA_Projection: currentPrice * shareCount,
    },
    ...predictions.map((p) => {
      const obj: Record<string, string | number> = {
        name: mapHorizonToLabel(p.horizonDays),
        Ensemble: p.expectedPrice * shareCount,
        AltBant: p.lowerBand * shareCount,
        ÜstBant: p.upperBand * shareCount,
      };
      p.models.forEach((m) => { obj[m.model] = m.prediction * shareCount; });
      return obj;
    }),
  ];

  return (
    <div className="border border-border rounded-xl bg-card p-6 shadow-sm mt-8">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" /> Modellerin Zaman Çizelgesindeki Beklentileri
      </h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.5 }} interval={Math.floor(predictions.length / 6)} />
            <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.5 }} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ fontSize: '12px', padding: '2px 0' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

            <Area type="monotone" dataKey="ÜstBant" fill="currentColor" fillOpacity={0.15} stroke="none" />
            <Area type="monotone" dataKey="AltBant" fill="var(--background)" fillOpacity={1} stroke="none" />

            <Line type="monotone" dataKey="RidgeRegression" stroke="oklch(0.6 0.15 200)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Ridge Regresyon" />
            <Line type="monotone" dataKey="MomentumExtrapolation" stroke="oklch(0.6 0.15 40)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Momentum" />
            <Line type="monotone" dataKey="MeanReversion" stroke="oklch(0.6 0.15 300)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Mean Reversion" />
            <Line type="monotone" dataKey="EMA_Projection" stroke="oklch(0.6 0.15 100)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="EMA Projeksiyonu" />

            <Line type="monotone" dataKey="Ensemble" stroke="var(--primary)" strokeWidth={3} dot={{ r: 2, fill: "var(--primary)" }} activeDot={{ r: 5 }} name="Nihai Ortak Beklenti" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AiAnalysisResult({ analysis, shareCount, isLoading = false, kronosPredictions, kronosLoading = false, kronosError, kronosDays = 14, onKronosDaysChange }: AiAnalysisResultProps) {
  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground animate-pulse border border-border bg-card rounded-xl">
        <Brain className="w-12 h-12 mb-4 opacity-50" />
        <div className="text-lg">Tüm zaman dilimleri için makine öğrenmesi modelleri test ediliyor...</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="py-20 text-center text-muted-foreground border border-border bg-card rounded-xl">
        Yeterli geçmiş veri bulunamadı. Algoritmaların çalışması için en az 50 günlük fiyat geçmişi gereklidir.
      </div>
    );
  }

  const currency = analysis.currency;
  const keyHorizons = [5, 15, 30, 60, 80, 120];
  const filteredPredictions = keyHorizons.map((target) => {
    return analysis.predictions.reduce((best, p) => {
      const diff = Math.abs(p.horizonDays - target);
      return diff < Math.abs(best.horizonDays - target) ? p : best;
    }, analysis.predictions[0]);
  }).filter((p, i, arr) => arr.findIndex((x) => x.horizonDays === p.horizonDays) === i);

  return (
    <div className="space-y-6">
      <DecisionCard
        decision={analysis.decision}
        signalScore={analysis.signalScore}
        currentPrice={analysis.currentPrice}
        volatility={analysis.volatility}
        shareCount={shareCount}
        regime={analysis.regime}
        currency={analysis.currency}
      />

      {/* Advanced Indicators Row */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <div className="font-semibold text-sm">İleri Teknik Göstergeler</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <IndicatorGauge label="Stochastic %K" value={analysis.indicators.stochastic.k} min={0} max={100} warnLow={20} warnHigh={80} />
          <IndicatorGauge label="Stochastic %D" value={analysis.indicators.stochastic.d} min={0} max={100} warnLow={20} warnHigh={80} />
          <IndicatorGauge label="ADX" value={analysis.indicators.adx} min={0} max={60} warnHigh={40} />
          <IndicatorGauge label="CCI" value={analysis.indicators.cci} min={-200} max={200} warnLow={-100} warnHigh={100} />
          <IndicatorGauge label="OBV" value={analysis.indicators.obv} min={-1e9} max={1e9} />
          <IndicatorGauge label="ATR" value={analysis.indicators.atr} min={0} max={analysis.currentPrice * 0.1} unit={` ${currency}`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-secondary/40 rounded-lg p-3 border border-border/50 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">VWAP</span>
            <span className="text-xs font-black">{analysis.indicators.vwap.toFixed(2)} {currency}</span>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3 border border-border/50 flex justify-between items-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Trend</span>
            <span className={`text-xs font-black ${analysis.trend === "YÜKSELEN" ? "text-[color:var(--success)]" : analysis.trend === "DÜŞEN" ? "text-destructive" : "text-muted-foreground"}`}>
              {analysis.trend}
            </span>
          </div>
        </div>
      </div>

      {/* Kronos AI Foundation Model Tahminleri */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div className="font-semibold text-sm">🧠 Kronos AI Tahmini (Foundation Model)</div>
          <div className="ml-auto flex items-center gap-1 bg-secondary/30 rounded-lg p-1 border border-border">
            {[5, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => onKronosDaysChange?.(days)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${kronosDays === days ? "bg-amber-500 text-white font-bold" : "text-muted-foreground hover:bg-secondary"}`}
              >
                {days} Gün
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          12 milyar K-line kaydı üzerinde eğitilmiş Transformer modeli. OHLCV verilerini doğrudan anlayarak gelecek fiyat tahminleri üretir.
        </p>

        {kronosLoading ? (
          <div className="text-muted-foreground animate-pulse text-sm py-6 text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
            Kronos Foundation Model tahmini hesaplanıyor...
          </div>
        ) : kronosError ? (
          <div className="text-xs text-muted-foreground py-4 text-center bg-secondary/30 rounded-lg">
            Kronos şu an devre dışı: {kronosError}
          </div>
        ) : kronosPredictions && kronosPredictions.length > 0 ? (
          <div>
            {analysis && (
              <div className="mb-4 p-4 bg-secondary/30 rounded-lg flex items-center justify-between border border-border/50">
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">Kronos Sinyali</div>
                  {(() => {
                    const lastPred = kronosPredictions[kronosPredictions.length - 1];
                    const totalChange = ((lastPred.close - analysis.currentPrice) / analysis.currentPrice) * 100;
                    const isUp = totalChange >= 0;
                    const isBuy = totalChange > 2;
                    const isSell = totalChange < -2;
                    const signal = isBuy ? "AL" : isSell ? "SAT" : "NÖTR";
                    const color = isBuy ? "text-[color:var(--success)]" : isSell ? "text-destructive" : "text-amber-500";
                    return (
                      <div className="flex items-center gap-3">
                        <div className={`text-lg font-black ${color} px-3 py-1 rounded bg-background border border-border shadow-sm`}>
                          {signal}
                        </div>
                        <div className={`text-sm font-bold ${isUp ? "text-[color:var(--success)]" : "text-destructive"}`}>
                          Beklenen Getiri: {isUp ? "+" : ""}{totalChange.toFixed(2)}% → {lastPred.close.toFixed(2)} {currency}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={kronosPredictions.map(p => ({
                  name: new Date(p.timestamp).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
                  Kapanış: parseFloat((p.close * shareCount).toFixed(2)),
                  AltBant: parseFloat((p.low * shareCount).toFixed(2)),
                  ÜstBant: parseFloat((p.high * shareCount).toFixed(2)),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.5 }} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.5 }} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ fontSize: '12px', padding: '2px 0' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="ÜstBant" fill="currentColor" fillOpacity={0.15} stroke="none" />
                  <Area type="monotone" dataKey="AltBant" fill="var(--background)" fillOpacity={1} stroke="none" />
                  <Line type="monotone" dataKey="Kapanış" stroke="var(--primary)" strokeWidth={3} dot={{ r: 2, fill: "var(--primary)" }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground py-4 text-center bg-secondary/30 rounded-lg">
            Kronos tahminleri yükleniyor veya henüz mevcut değil.
          </div>
        )}
      </div>

      {/* Risk Management */}
      <RiskManagementCard currency={currency} risk={analysis.riskManagement} currentPrice={analysis.currentPrice} />

      <h2 className="text-xl font-bold mt-8 mb-4 border-b border-border pb-2 flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" /> Zaman Dilimlerine Göre Makine Öğrenmesi Raporları
      </h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredPredictions.map((p) => (
          <HorizonCard currency={currency} key={p.horizonDays} prediction={p} currentPrice={analysis.currentPrice} shareCount={shareCount} />
        ))}
      </div>

      <ProjectionChart predictions={analysis.predictions} currentPrice={analysis.currentPrice} shareCount={shareCount} />
    </div>
  );
}
