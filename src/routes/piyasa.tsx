import { MarketDataStatus } from "@/components/MarketDataStatus";
import { useBistData } from "@/lib/useBistData";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { TrendingUp, TrendingDown, RefreshCw, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, AlertCircle } from "lucide-react";
import { AiAnalysisTable } from "@/components/AiAnalysisTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/piyasa")({
  head: () => ({
    meta: [
      { title: "Piyasa Verileri - stockbear" },
      { name: "description", content: "BIST hisselerinin sağlayıcı fiyatları, sektör performansı ve piyasa verileri." },
    ],
  }),
  component: PiyasaPage,
});

type SortKey = "symbol" | "sector" | "price" | "changePercent" | "volume" | "high52" | "low52";

function PiyasaPage() {
  const [tab, setTab] = useState<"all" | "gainers" | "losers" | "volume">("all");
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Tümü");
  const [sortKey, setSortKey] = useState<SortKey | null>("symbol");
  const [sortAsc, setSortAsc] = useState(true);


  const market = useBistData();
  const liveData = market.stocks;
  const { isLoading, refetch, isFetching, isError } = market;

  const displayData = liveData.map(d => ({ ...d, pe: 0, marketCap: 0 }));

  const sectors = ["Tümü", ...Array.from(new Set(displayData.map((s) => s.sector)))];

  const filtered = useMemo(() => {
    let arr = [...displayData];

    // Arama filtresi
    if (search) {
      const q = search.toUpperCase();
      arr = arr.filter((s) =>
        s.symbol.includes(q) || s.name.toUpperCase().includes(q)
      );
    }

    // Sektör filtresi
    if (sectorFilter !== "Tümü") {
      arr = arr.filter((s) => s.sector === sectorFilter);
    }

    // Tab filtresi
    if (tab === "gainers") arr = arr.filter((s) => s.changePercent > 0);
    if (tab === "losers") arr = arr.filter((s) => s.changePercent < 0);
    if (tab === "volume") arr = [...arr].sort((a, b) => b.volume - a.volume);

    // Sıralama
    if (sortKey) {
      arr.sort((a, b) => {
        let av: number | string, bv: number | string;
        switch (sortKey) {
          case "symbol": av = a.symbol; bv = b.symbol; return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av as string);
          case "sector": av = a.sector; bv = b.sector; return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av as string);
          case "price": av = a.price; bv = b.price; break;
          case "changePercent": av = a.changePercent; bv = b.changePercent; break;
          case "volume": av = a.volume; bv = b.volume; break;
          case "high52": av = a.high52; bv = b.high52; break;
          case "low52": av = a.low52; bv = b.low52; break;
          default: return 0;
        }
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
      });
    }

    return arr;
  }, [tab, search, sectorFilter, sortKey, sortAsc, displayData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortAsc) setSortAsc(false);
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const gainers = displayData.filter((s) => s.changePercent > 0).length;
  const losers = displayData.filter((s) => s.changePercent < 0).length;
  const totalVol = displayData.reduce((a, b) => a + b.volume, 0);
  const avgChange = displayData.length > 0 ? displayData.reduce((a, b) => a + b.changePercent, 0) / displayData.length : 0;

  return (
    <AppShell>
      <PageHeader
        title="Piyasa Özeti"
        subtitle={`${displayData.length} hisse — sağlayıcı fiyatları, sektör analizi ve detaylı tablo.`}
        action={
          <button onClick={() => refetch()} disabled={isFetching} className="bg-secondary border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2 hover:border-primary/40 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Güncelleniyor..." : "Yenile"}
          </button>
        }
      />

      <MarketDataStatus {...market} hasData={liveData.length > 0} onRetry={() => refetch()} label="En eski fiyat zamanı" />
      {/* Özet kartları */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Toplam Hisse", value: displayData.length.toString(), sub: "BIST" },
          { label: "Yükselen", value: gainers.toString(), sub: "adet", up: true },
          { label: "Düşen", value: losers.toString(), sub: "adet", up: false },
          { label: "Toplam Hacim", value: `${(totalVol / 1e9).toFixed(1)} Mlr lot`, sub: "günlük" },
          { label: "Ort. Değişim", value: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`, sub: "ortalama", up: avgChange >= 0 },
        ].map((k) => (
          <div key={k.label} className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
            <div className="relative z-10">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-2xl font-bold mt-1 ${k.up === true ? "text-[color:var(--success)]" : k.up === false ? "text-destructive" : ""}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Arama ve filtreler */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Hisse ara... (THY, ASELS, Garanti)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Hisse ara"
            className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <button aria-label="Filtreler" className="relative flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-secondary hover:border-primary/40 transition-colors">
              <Filter className="w-5 h-5 text-foreground" />
              <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-md">+</div>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-4 space-y-4 rounded-xl border border-border bg-card shadow-lg z-50">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Görünüm</h4>
              <div className="grid grid-cols-1 gap-1">
                {[
                  { k: "all", l: `Tümü (${displayData.length})` },
                  { k: "gainers", l: `Yükselen (${gainers})` },
                  { k: "losers", l: `Düşen (${losers})` },
                  { k: "volume", l: "En Yüksek Hacim" },
                ].map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k as typeof tab)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${tab === t.k ? "bg-primary text-primary-foreground font-medium" : "hover:bg-secondary text-muted-foreground"}`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Sektör Filtresi</h4>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
              >
                {sectors.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tablo */}
      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className="animate-pulse text-muted-foreground">Piyasa verileri yükleniyor…</div>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
          <div className="text-sm font-semibold text-destructive">Veri yüklenemedi</div>
          <p className="text-xs text-muted-foreground mt-1">Yahoo Finance API'sine erişilemiyor. Lütfen daha sonra tekrar deneyin.</p>
          <button onClick={() => refetch()} className="mt-3 text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 hover:border-primary/40 inline-flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" /> Tekrar Dene
          </button>
        </div>
      )}

      <div className="mt-4">
        <AiAnalysisTable />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left font-normal p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort("symbol")}>
                  <span className="inline-flex items-center gap-1">Hisse <SortIcon k="symbol" /></span>
                </th>
                <th className="text-left font-normal cursor-pointer hover:text-foreground" onClick={() => handleSort("sector")}>
                  <span className="inline-flex items-center gap-1">Sektör <SortIcon k="sector" /></span>
                </th>
                <th className="text-right font-normal cursor-pointer hover:text-foreground" onClick={() => handleSort("price")}>
                  <span className="inline-flex items-center gap-1">Fiyat <SortIcon k="price" /></span>
                </th>
                <th className="text-right font-normal cursor-pointer hover:text-foreground" onClick={() => handleSort("changePercent")}>
                  <span className="inline-flex items-center gap-1">Değişim <SortIcon k="changePercent" /></span>
                </th>
                <th className="text-right font-normal cursor-pointer hover:text-foreground" onClick={() => handleSort("volume")}>
                  <span className="inline-flex items-center gap-1">Hacim <SortIcon k="volume" /></span>
                </th>
                <th className="text-right font-normal">52H Düşük</th>
                <th className="text-right font-normal">52H Yüksek</th>
                <th className="text-right font-normal pr-3">Grafik</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.symbol} className="border-b border-border hover:bg-secondary/40 transition-colors">
                  <td className="p-3">
                    <Link to="/analiz" search={{ symbol: s.symbol }} className="font-semibold hover:text-primary">{s.symbol}</Link>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">{s.name}</div><div className="text-[10px] text-muted-foreground">{new Date(s.asOf).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}{market.unavailableSymbols.includes(s.symbol) ? " · Yenilenemedi" : ""}</div>
                  </td>
                  <td className="text-muted-foreground text-xs">{s.sector}</td>
                  <td className="text-right font-medium">{typeof s.price === "number" ? s.price.toFixed(2) : s.price} TL</td>
                  <td className="text-right">
                    <span className={`inline-flex items-center gap-1 font-semibold ${s.changePercent >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                      {s.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {s.changePercent >= 0 ? "+" : ""}{typeof s.changePercent === "number" ? s.changePercent.toFixed(2) : s.changePercent}%
                    </span>
                  </td>
                  <td className="text-right text-muted-foreground text-xs">{(s.volume / 1e6).toFixed(0)} Mn</td>
                  <td className="text-right text-muted-foreground text-xs">{s.low52 || "—"}</td>
                  <td className="text-right text-muted-foreground text-xs">{s.high52 || "—"}</td>
                  <td className="text-right pr-3">
                    <div className="w-20 inline-block">
                      <Link to="/grafik" search={{ symbol: s.symbol }} className="text-xs text-primary underline">Grafiği aç</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !isLoading && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">{isError ? "Piyasa verisi alınamadı." : "Aramanızla eşleşen hisse bulunamadı."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="p-3 border-t border-border text-xs text-muted-foreground text-right">
            {filtered.length} hisse gösteriliyor
          </div>
        )}
      </div>
    </AppShell>
  );
}
