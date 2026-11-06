import { MarketDataStatus } from "@/components/MarketDataStatus";
import { useBistData } from "@/lib/useBistData";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Filter, RefreshCw, TrendingUp, TrendingDown, BarChart3, Target, Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

const screenerSearchSchema = z.object({
  preset: z.enum(["hepsi", "düşükFk", "yüksekHacim", "yükselen", "52Hdüşük", "teknoloji", "bankacılık"]).optional(),
  sector: z.string().optional(),
  sort: z.enum(["changePercent", "volume", "price", "pe"]).optional(),
});

export const Route = createFileRoute("/screener")({
  validateSearch: screenerSearchSchema,
  head: () => ({
    meta: [
      { title: "Hisse Screener — stockbear" },
      { name: "description", content: "48 BIST hissesini kriterlerinize göre filtreleyin." },
      { property: "og:title", content: "Hisse Screener — stockbear" },
    ],
  }),
  component: ScreenerPage,
});

type FilterPreset = "hepsi" | "düşükFk" | "yüksekHacim" | "yükselen" | "52Hdüşük" | "teknoloji" | "bankacılık";

function ScreenerPage() {
  const { preset: urlPreset, sector: urlSector, sort: urlSort } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [preset, setPresetState] = useState<FilterPreset>((urlPreset as FilterPreset) || "hepsi");
  const [sector, setSectorState] = useState(urlSector || "Tümü");
  const [minChange, setMinChange] = useState(-10);
  const [maxChange, setMaxChange] = useState(10);
  const [maxPE, setMaxPE] = useState(30);
  const [minPE, setMinPE] = useState(0);
  const [minVolume, setMinVolume] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [onlyGainers, setOnlyGainers] = useState(false);
  const [onlyLosers, setOnlyLosers] = useState(false);
  const [near52Low, setNear52Low] = useState(false);
  const [near52High, setNear52High] = useState(false);
  const [sortBy, setSortBy] = useState<"changePercent" | "volume" | "price" | "pe">((urlSort as "changePercent" | "volume" | "price" | "pe") || "changePercent");

  const applyFilter = (newPreset: FilterPreset, newSector: string, newSort: "changePercent" | "volume" | "price" | "pe") => {
    setPresetState(newPreset);
    setSectorState(newSector);
    setSortBy(newSort);
    navigate({ search: { preset: newPreset === "hepsi" ? undefined : newPreset, sector: newSector === "Tümü" ? undefined : newSector, sort: newSort === "changePercent" ? undefined : newSort }, replace: true });
  };
  const setSector = (s: string) => {
    setSectorState(s);
    navigate({ search: { preset: preset === "hepsi" ? undefined : preset, sector: s === "Tümü" ? undefined : s, sort: sortBy === "changePercent" ? undefined : sortBy }, replace: true });
  };


  const market = useBistData();
  const liveData = market.stocks;
  const { isLoading, refetch, isFetching, isError } = market;

  const displayData = liveData.map(d => ({ ...d, pe: 0, marketCap: 0 }));

  const sectors = ["Tümü", ...Array.from(new Set(displayData.map((s) => s.sector)))];

  const filtered = useMemo(() => {
    let arr = [...displayData];

    // Preset filtreleri
    if (preset === "düşükFk") arr = arr.filter((s) => s.pe > 0 && s.pe < 8);
    if (preset === "yüksekHacim") arr = arr.filter((s) => s.volume > 1e9);
    if (preset === "yükselen") arr = arr.filter((s) => s.changePercent > 0);
    if (preset === "52Hdüşük") arr = arr.filter((s) => s.low52 > 0 && s.price < s.low52 * 1.15);

    // Manuel filtreler
    if (sector !== "Tümü") arr = arr.filter((s) => s.sector === sector);
    arr = arr.filter((s) => s.changePercent >= minChange && s.changePercent <= maxChange);
    // This provider does not supply P/E data.
    arr = arr.filter((s) => s.volume >= minVolume * 1e6);
    arr = arr.filter((s) => s.price >= minPrice && s.price <= maxPrice);
    if (onlyGainers) arr = arr.filter((s) => s.changePercent > 0);
    if (onlyLosers) arr = arr.filter((s) => s.changePercent < 0);
    if (near52Low) arr = arr.filter((s) => s.low52 > 0 && s.price < s.low52 * 1.15);
    if (near52High) arr = arr.filter((s) => s.high52 > 0 && s.price > s.high52 * 0.85);

    // Sıralama
    arr.sort((a, b) => {
      switch (sortBy) {
        case "changePercent": return b.changePercent - a.changePercent;
        case "volume": return b.volume - a.volume;
        case "price": return b.price - a.price;
        case "pe": return a.pe - b.pe;
        default: return 0;
      }
    });

    return arr;
  }, [preset, sector, minChange, maxChange, minVolume, minPrice, maxPrice, onlyGainers, onlyLosers, near52Low, near52High, sortBy, displayData]);

  const resetFilters = () => {
    applyFilter("hepsi", "Tümü", "changePercent");
    setMinChange(-10);
    setMaxChange(10);
    setMaxPE(30);
    setMinPE(0);
    setMinVolume(0);
    setMinPrice(0);
    setMaxPrice(1000);
    setOnlyGainers(false);
    setOnlyLosers(false);
    setNear52Low(false);
    setNear52High(false);
    setSortBy("changePercent");
  };

  const SectorBar = () => {
    const sectorCounts = displayData.reduce((acc, s) => {
      acc[s.sector] = (acc[s.sector] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const maxCount = Math.max(1, ...Object.values(sectorCounts));
    return (
      <div className="space-y-2">
        {Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
          <div key={name} className="flex items-center gap-2">
            <div className="w-20 text-xs text-muted-foreground truncate">{name}</div>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
            </div>
            <div className="w-8 text-xs text-right text-muted-foreground">{count}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppShell>
      <PageHeader
        title="Hisse Screener"
        subtitle={`${displayData.length} hisse içinden kriterlerinize göre filtreleyin.`}
        action={
          <button onClick={() => refetch()} disabled={isFetching} className="bg-secondary border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2 hover:border-primary/40 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Yenile
          </button>
        }
      />

      <MarketDataStatus {...market} hasData={liveData.length > 0} onRetry={() => refetch()} label="En eski fiyat zamanı" />
      {/* Preset butonları */}
      <div className="flex flex-wrap gap-2">
        {([
          { k: "hepsi", l: "Tümü", icon: BarChart3 },
          { k: "düşükFk", l: "Düşük F/K (<8)", icon: Target },
          { k: "yüksekHacim", l: "Yüksek Hacim (>1 Mlr lot)", icon: Activity },
          { k: "yükselen", l: "Yükselenler", icon: TrendingUp },
          { k: "52Hdüşük", l: "52H Düşüğünde", icon: TrendingDown },
          { k: "teknoloji", l: "Teknoloji", icon: Filter },
          { k: "bankacılık", l: "Bankacılık", icon: Filter },
        ] as const).map((p) => (
          <button
            key={p.k}
            disabled={p.k === "düşükFk"}
            title={p.k === "düşükFk" ? "F/K verisi sağlanmıyor" : undefined}
            onClick={() => {
              let newSector = "Tümü";
              let newSort: "changePercent" | "price" | "volume" | "pe" = "changePercent";
              if (p.k === "teknoloji") { newSector = "Teknoloji"; }
              else if (p.k === "bankacılık") { newSector = "Bankacılık"; }
              else if (p.k === "düşükFk") { newSort = "pe"; }
              else if (p.k === "yüksekHacim") { newSort = "volume"; }
              else if (p.k === "52Hdüşük") { newSort = "price"; }
              applyFilter(p.k, newSector, newSort);
            }}
            aria-pressed={preset === p.k}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${preset === p.k ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-primary/40"}`}
          >
            <p.icon className="w-3.5 h-3.5" />
            {p.l}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Filtre paneli */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /><div className="font-semibold text-sm">Filtreler</div></div>
              <button onClick={resetFilters} aria-label="Filtreleri sıfırla" className="text-xs text-primary hover:underline">Sıfırla</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Sektör</label>
                <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sektör filtresi" className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
                  {sectors.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Fiyat Aralığı: {minPrice} - {maxPrice} TL</label>
                <div className="flex gap-2 mt-1">
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(+e.target.value)} aria-label="Minimum fiyat" className="w-1/2 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs" placeholder="Min" />
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} aria-label="Maksimum fiyat" className="w-1/2 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs" placeholder="Max" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Değişim: {minChange}% — {maxChange}%</label>
                <div className="flex gap-2 mt-1">
                  <input type="range" min={-10} max={10} step={0.5} value={minChange} onChange={(e) => setMinChange(+e.target.value)} aria-label="Minimum değişim" className="w-1/2 accent-primary" />
                  <input type="range" min={-10} max={10} step={0.5} value={maxChange} onChange={(e) => setMaxChange(+e.target.value)} aria-label="Maksimum değişim" className="w-1/2 accent-primary" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">F/K verisi sağlanmıyor</label>
                <div className="flex gap-2 mt-1">
                  <input type="range" disabled min={0} max={30} value={minPE} onChange={(e) => setMinPE(+e.target.value)} aria-label="Minimum F/K" className="w-1/2 accent-primary" />
                  <input type="range" disabled min={1} max={50} value={maxPE} onChange={(e) => setMaxPE(+e.target.value)} aria-label="Maksimum F/K" className="w-1/2 accent-primary" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Min. Hacim: {minVolume} Mn lot</label>
                <input type="range" min={0} max={5000} step={100} value={minVolume} onChange={(e) => setMinVolume(+e.target.value)} aria-label="Minimum hacim" className="w-full accent-primary" />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={onlyGainers} onChange={(e) => { setOnlyGainers(e.target.checked); setOnlyLosers(false); }} className="accent-primary" />
                  Sadece Yükselenler
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={onlyLosers} onChange={(e) => { setOnlyLosers(e.target.checked); setOnlyGainers(false); }} className="accent-primary" />
                  Sadece Düşenler
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={near52Low} onChange={(e) => { setNear52Low(e.target.checked); setNear52High(false); }} className="accent-primary" />
                  52 Hafta Düşüğünde
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={near52High} onChange={(e) => { setNear52High(e.target.checked); setNear52Low(false); }} className="accent-primary" />
                  52 Hafta Zirvesinde
                </label>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Sıralama</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
                  <option value="changePercent">Değişim (%)</option>
                  <option value="volume">Hacim</option>
                  <option value="price">Fiyat</option>
                  <option value="pe" disabled>F/K verisi sağlanmıyor</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{filtered.length}</div>
                <div className="text-xs text-muted-foreground">hisse eşleşti</div>
              </div>
            </div>
          </div>

          {/* Sektör dağılımı */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="font-semibold text-sm mb-3">Sektör Dağılımı</div>
            <SectorBar />
          </div>
        </div>

        {/* Sonuç tablosu */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Piyasa verileri yükleniyor...</div>
          )}
          {isError && !isLoading && (
            <div className="p-8 text-center text-destructive text-sm">
              Veriler yüklenemedi. <button onClick={() => refetch()} className="underline hover:no-underline">Tekrar dene</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-3 font-normal">Hisse</th>
                  <th className="text-left font-normal">Sektör</th>
                  <th className="text-right font-normal">Fiyat</th>
                  <th className="text-right font-normal">Değişim</th>
                  <th className="text-right font-normal">Hacim</th>
                  <th className="text-right font-normal">F/K</th>
                  <th className="text-right font-normal">52H</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.symbol} className="border-b border-border hover:bg-secondary/40 transition-colors">
                    <td className="p-3">
                      <Link to="/analiz" search={{ symbol: s.symbol }} className="font-semibold hover:text-primary">{s.symbol}</Link>
                      <div className="text-xs text-muted-foreground truncate max-w-[100px]">{s.name}</div><div className="text-[10px] text-muted-foreground">{new Date(s.asOf).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}{market.unavailableSymbols.includes(s.symbol) ? " · Yenilenemedi" : ""}</div>
                    </td>
                    <td className="text-muted-foreground text-xs">{s.sector}</td>
                    <td className="text-right">{typeof s.price === "number" ? s.price.toFixed(2) : s.price} TL</td>
                    <td className="text-right">
                      <span className={`font-semibold ${s.changePercent >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
                        {s.changePercent >= 0 ? "+" : ""}{typeof s.changePercent === "number" ? s.changePercent.toFixed(2) : s.changePercent}%
                      </span>
                    </td>
                    <td className="text-right text-muted-foreground text-xs">{(s.volume / 1e6).toFixed(0)} Mn</td>
                    <td className="text-right text-xs">{s.pe > 0 ? s.pe.toFixed(1) : "-"}</td>
                    <td className="text-right text-xs text-muted-foreground">{s.low52} - {s.high52}</td>
                  </tr>
                ))}
                {filtered.length === 0 && !isLoading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">Eşleşen hisse bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
