import { MarketDataStatus } from "@/components/MarketDataStatus";
import { useBistData } from "@/lib/useBistData";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles, ArrowRight, Crown, TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";
import heroImg from "@/assets/hero-bull-ai.jpg";
import logo from "@/assets/stockbear-logo.png";
import { AppShell } from "@/components/AppShell";
import { SECTOR_MAP } from "@/lib/market-data";
import { useServerFn } from "@tanstack/react-start";
import { fetchIndexes, fetchNews } from "@/lib/ai.functions";
import { useQuery } from "@tanstack/react-query";
import type { StockData } from "@/lib/ai.functions";

type DisplayItem = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  high52: number;
  low52: number;
  sector: string;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "stockbear — Hisse Analizi ve AI Karar Motoru" },
      { name: "description", content: "BIST hisselerini yapay zeka ile analiz edin, portföyünüzü takip edin, teknik göstergeleri inceleyin." },
      { property: "og:title", content: "stockbear — Hisse Analizi ve AI Karar Motoru" },
      { property: "og:description", content: "BIST hisselerini yapay zeka ile analiz edin, portföyünüzü takip edin." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchIdx = useServerFn(fetchIndexes);

  const fetchNewsFn = useServerFn(fetchNews);

  const { data: indexes = [], isLoading: loadingIdx, isError: indexError, refetch: refreshIndexes } = useQuery({
    queryKey: ["indexes"],
    queryFn: () => fetchIdx({}),
    staleTime: 60_000,
    refetchInterval: 120_000,
    throwOnError: false,
  });

  const market = useBistData();
  const bistData = market.stocks;

  const { data: news = [] } = useQuery({
    queryKey: ["news-home"],
    queryFn: async () => {
      try { return await fetchNewsFn({}); } catch (e) { console.warn("fetchNews error:", e); return []; }
    },
    staleTime: 300_000,
    throwOnError: false,
  });

  const displayStocks: DisplayItem[] = useMemo(() => bistData.length > 0
    ? bistData.map((d: StockData) => ({
        ...d,
        change: d.change,
        changePercent: d.changePercent,
        sector: SECTOR_MAP[d.symbol] || "Diğer",
      }))
    : [], [bistData]);
  const displayIndexes = indexes;

  const formatVal = (name: string, val: number) => {
    if (name.includes("DOLAR") || name.includes("EUR")) return val.toFixed(4);
    if (name.includes("ALTIN")) return val.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
    return val.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  };

  // Sektör analizi
  const sectors = useMemo(() => {
    const result = displayStocks.reduce((acc, s) => {
      const sector = s.sector;
      const existing = acc.find((a) => a.name === sector);
      if (existing) {
        existing.stocks.push(s);
        existing.avgChange += s.changePercent;
      } else {
        acc.push({ name: sector, stocks: [s], avgChange: s.changePercent });
      }
      return acc;
    }, [] as { name: string; stocks: DisplayItem[]; avgChange: number }[]);
    result.forEach((s) => { s.avgChange /= s.stocks.length; });
    return result;
  }, [displayStocks]);

  const gainers = useMemo(() => [...displayStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5), [displayStocks]);
  const losers = useMemo(() => [...displayStocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5), [displayStocks]);
  const highVolume = useMemo(() => [...displayStocks].sort((a, b) => b.volume - a.volume).slice(0, 5), [displayStocks]);

  return (
    <AppShell>
      {/* Hero section */}
      <section className="relative rounded-2xl border border-border bg-card overflow-hidden p-8 md:p-10" style={{ background: "linear-gradient(135deg, oklch(0.18 0.01 260), oklch(0.16 0.02 60 / 0.6))" }}>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">Hisse Analizi<br /><span className="text-primary">Gerçek Veri</span> ile</h1>
            <p className="text-muted-foreground mt-4">Yahoo Finance üzerinden BIST verileri. {displayStocks.length} hisse, teknik analiz, sektör analizi. Veriyi anlayın, fırsatı yakalayın.</p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/analiz" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium rounded-lg px-5 py-3 hover:bg-primary/90" style={{ boxShadow: "var(--shadow-gold)" }}>
                Hisse Analizine Başla <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/ai" className="inline-flex items-center gap-2 bg-secondary border border-border font-medium rounded-lg px-5 py-3 hover:bg-secondary/70">
                Piyasa Analizine Bak <Sparkles className="w-4 h-4 text-primary" />
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <img src={heroImg} alt="Borsa analizi" width={1024} height={1024} className="w-full max-w-sm rounded-2xl" />
          </div>
        </div>
      </section>

      <MarketDataStatus {...market} hasData={bistData.length > 0} onRetry={() => market.refetch()} label="En eski hisse fiyat zamanı" />
      <MarketDataStatus isLoading={loadingIdx} isError={indexError} hasData={indexes.length > 0} asOf={indexes.map(i => i.asOf).sort()[0]} onRetry={() => refreshIndexes()} label="En eski endeks zamanı" />
      {/* Endeksler */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {displayIndexes.map((idx) => {
          const up = idx.changePercent >= 0;
          return (
            <div key={idx.name} className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <div className="text-xs text-muted-foreground font-medium">{idx.name}</div>
              {loadingIdx ? (
                <div className="h-8 bg-secondary rounded animate-pulse mt-1" />
              ) : (
                <>
                  <div className="text-xl font-bold mt-1">{formatVal(idx.name, idx.value)}</div>
                  <div className={`text-xs font-medium mt-1 ${up ? "text-[color:var(--success)]" : "text-destructive"}`}>
                    {up ? "+" : ""}{idx.changePercent.toFixed(2)}%
                  </div>
                </>
              )}
              <div className="mt-2 text-[10px] text-muted-foreground">Yahoo Finance · {new Date(idx.asOf).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</div>
            </div>
          );
        })}
      </section>

      {/* Ana içerik */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* Popüler hisseler */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Popüler Hisseler</h3>
            <Link to="/piyasa" className="text-xs text-primary">Tümü ({displayStocks.length} hisse)</Link>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th className="font-normal py-2">Hisse</th>
                <th className="font-normal">Sektör</th>
                <th className="font-normal text-right">Fiyat</th>
                <th className="font-normal text-right">Günlük</th>
                <th className="font-normal text-right">Hacim</th>
              </tr>
            </thead>
            <tbody>
              {displayStocks.slice(0, 8).map((p) => (
                <tr key={p.symbol} className="border-t border-border hover:bg-secondary/40 cursor-pointer transition-colors">
                  <td className="py-2.5">
                    <Link to="/analiz" search={{ symbol: p.symbol }} className="font-semibold hover:text-primary">{p.symbol}</Link>
                    <div className="text-[10px] text-muted-foreground">{p.name}</div>
                  </td>
                  <td className="text-xs text-muted-foreground">{SECTOR_MAP[p.symbol] || "Diğer"}</td>
                  <td className="text-right">{typeof p.price === "number" ? p.price.toFixed(2) : p.price} TL</td>
                  <td className={`text-right font-semibold ${p.changePercent >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>{p.changePercent >= 0 ? "+" : ""}{typeof p.changePercent === "number" ? p.changePercent.toFixed(2) : p.changePercent}%</td>
                  <td className="text-right text-muted-foreground text-xs">{(p.volume / 1e9).toFixed(2)} Mlr lot</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Haberler */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Son Haberler</h3>
            <Link to="/haberler" className="text-xs text-primary">Tümü</Link>
          </div>
          <div className="space-y-3">
            {news.slice(0, 5).map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-secondary/50 border border-border p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{n.tag}</span>
                  <span className="text-[10px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="text-xs font-medium line-clamp-2">{n.title}</p>
                <div className="text-[10px] text-muted-foreground mt-1">{n.source}</div>
              </a>
            ))}
            {news.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">Haberler yükleniyor...</div>}
          </div>
        </div>
      </section>

      {/* Yükselenler, Düşenler, Sektörler */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* En çok yükselenler */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[color:var(--success)]" /> En Çok Yükselenler</h3>
            <Link to="/ai" className="text-xs text-primary">Tümü</Link>
          </div>
          <div className="space-y-2">
            {gainers.map((s: DisplayItem) => (
              <Link key={s.symbol} to="/analiz" search={{ symbol: s.symbol }} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                <div>
                  <div className="font-semibold text-sm">{s.symbol}</div>
                  <div className="text-[10px] text-muted-foreground">{s.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{typeof s.price === "number" ? s.price.toFixed(2) : s.price} TL</div>
                  <div className="text-xs text-[color:var(--success)] font-semibold">+{typeof s.changePercent === "number" ? s.changePercent.toFixed(2) : s.changePercent}%</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* En çok düşenler */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" /> En Çok Düşenler</h3>
            <Link to="/ai" className="text-xs text-primary">Tümü</Link>
          </div>
          <div className="space-y-2">
            {losers.map((s: DisplayItem) => (
              <Link key={s.symbol} to="/analiz" search={{ symbol: s.symbol }} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                <div>
                  <div className="font-semibold text-sm">{s.symbol}</div>
                  <div className="text-[10px] text-muted-foreground">{s.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{typeof s.price === "number" ? s.price.toFixed(2) : s.price} TL</div>
                  <div className="text-xs text-destructive font-semibold">{typeof s.changePercent === "number" ? s.changePercent.toFixed(2) : s.changePercent}%</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Sektörler */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Sektör Performansı</h3>
          </div>
          <div className="space-y-3">
            {sectors.sort((a: { name: string; stocks: DisplayItem[]; avgChange: number }, b: { name: string; stocks: DisplayItem[]; avgChange: number }) => b.avgChange - a.avgChange).map((s: { name: string; stocks: DisplayItem[]; avgChange: number }) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{s.name} ({s.stocks.length})</span>
                  <span className={`font-semibold ${s.avgChange >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                    {s.avgChange >= 0 ? "+" : ""}{s.avgChange.toFixed(2)}%
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.avgChange >= 0 ? "bg-[color:var(--success)]" : "bg-destructive"}`} style={{ width: `${Math.min(Math.abs(s.avgChange) * 20, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Yüksek hacimli hisseler */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> En Yüksek Hacimli Hisseler</h3>
          <Link to="/piyasa" className="text-xs text-primary">Tümünü Gör</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {highVolume.map((s: DisplayItem) => (
            <Link key={s.symbol} to="/analiz" search={{ symbol: s.symbol }} className="rounded-lg bg-secondary/50 border border-border p-3 hover:border-primary/40 transition-colors">
              <div className="font-semibold text-sm">{s.symbol}</div>
              <div className="text-[10px] text-muted-foreground mb-2">{s.name}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{typeof s.price === "number" ? s.price.toFixed(2) : s.price} TL</span>
                <span className={`text-xs font-semibold ${s.changePercent >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                  {s.changePercent >= 0 ? "+" : ""}{typeof s.changePercent === "number" ? s.changePercent.toFixed(2) : s.changePercent}%
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Hacim: {(s.volume / 1e9).toFixed(2)} Mlr lot</div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-primary/30 p-5 flex flex-wrap items-center justify-between gap-4" style={{ background: "linear-gradient(90deg, oklch(0.22 0.05 82 / 0.5), oklch(0.18 0.01 260))" }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center"><Crown className="w-5 h-5 text-primary" /></div>
          <div>
            <div className="font-semibold">Detaylı Hisse Analizi</div>
            <p className="text-sm text-muted-foreground">{displayStocks.length}+ hisse için teknik analiz, grafikler, RSI, MACD ve sağlayıcı fiyat verisi.</p>
          </div>
        </div>
        <Link to="/analiz" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium rounded-lg px-5 py-3 hover:bg-primary/90">Analize Git <ArrowRight className="w-4 h-4" /></Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2"><img src={logo} alt="stockbear" width={32} height={32} className="w-8 h-8" /><span className="font-bold">stock<span className="text-primary">bear</span></span></div>
        <nav className="flex flex-wrap gap-6 text-muted-foreground">
          <a href="https://github.com/BaranBaser/stockbear" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <div className="text-xs text-muted-foreground">Veri: Yahoo Finance | {displayStocks.length}+ hisse</div>
      </footer>
    </AppShell>
  );
}
