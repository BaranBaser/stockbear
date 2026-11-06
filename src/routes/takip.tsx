import { MarketDataStatus } from "@/components/MarketDataStatus";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, Sparkline } from "@/components/AppShell";
import { stocks, findStock } from "@/lib/market-data";
import { useWatchlist } from "@/lib/storage";
import { useServerFn } from "@tanstack/react-start";
import { fetchStockHistory } from "@/lib/ai.functions";
import { useQuery } from "@tanstack/react-query";
import { useLivePrice } from "@/lib/useLivePrice";
import { Star, Plus, X, Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/takip")({
  head: () => ({
    meta: [
      { title: "Takip Listem — stockbear" },
      { name: "description", content: "Beğendiğiniz hisseleri takip edin, sağlayıcı fiyatlarını izleyin." },
      { property: "og:title", content: "Takip Listem — stockbear" },
    ],
  }),
  component: TakipPage,
});

function WatchlistCard({ symbol, onToggle }: { symbol: string; onToggle: () => void }) {
  const quote = useLivePrice(symbol);
  const { price, changePercent, volume, isLoading, hasData } = quote;
  const staticStock = findStock(symbol);
  const fetchHistory = useServerFn(fetchStockHistory);

  const { data: sparklineData = [], isError: historyError } = useQuery({
    queryKey: ["sparkline", symbol],
    queryFn: async () => (await fetchHistory({ data: { symbol, range: "3mo" } })).map(h => h.close),
    retry: false,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  const finalPrice = price;
  const finalChange = changePercent;
  const finalVolume = volume;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/analiz" search={{ symbol }} className="font-bold text-lg hover:text-primary">{symbol}</Link>
          <div className="text-xs text-muted-foreground">{staticStock?.name || symbol}</div>
        </div>
        <button onClick={onToggle} aria-label="Takipten çıkar" className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-bold">{isLoading ? "…" : hasData ? `${finalPrice.toFixed(2)} TL` : "Fiyat alınamadı"}</div>
        <div className={`text-sm ${finalChange >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
          {hasData ? `${finalChange >= 0 ? "+" : ""}${finalChange.toFixed(2)}%` : "—"}
        </div>
        {!isLoading && hasData && !quote.isError && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--success)] inline-block" />}
      </div>
      <MarketDataStatus {...quote} onRetry={() => quote.refetch()} />
      <div className="mt-3">
        {sparklineData.length > 1 ? <Sparkline
          data={sparklineData}
          color={finalChange >= 0 ? "oklch(0.72 0.19 145)" : "oklch(0.65 0.22 25)"}
          height={60}
        /> : <p className="text-xs text-muted-foreground">{historyError ? "Geçmiş verisi alınamadı." : "Grafik verisi bekleniyor."}</p>}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
        <span>Hacim: {hasData ? `${(finalVolume / 1e6).toFixed(1)} Mn lot` : "—"}</span>
        <span>F/K: Veri sağlanmıyor</span>
      </div>
    </div>
  );
}

function TakipPage() {
  const { list, toggle } = useWatchlist();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const notAdded = useMemo(() => {
    const filtered = stocks.filter((s) => !list.includes(s.symbol));
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toUpperCase();
    return filtered.filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q));
  }, [list, searchQuery]);

  return (
    <AppShell>
      <PageHeader
        title="Takip Listem"
        subtitle="Favori hisselerinizi buradan izleyin. Listeniz bu tarayıcıda saklanır."
        action={<button onClick={() => setShowAdd(!showAdd)} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90"><Plus className="w-4 h-4" /> Hisse Ekle</button>}
      />

      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold mb-3">Hisse Ekle</div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Hisse ara"
              placeholder="Hisse adı veya kodu ara..."
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {notAdded.map((s) => (
              <button key={s.symbol} onClick={() => toggle(s.symbol)} className="text-xs bg-secondary border border-border rounded-full px-3 py-1.5 hover:border-primary/40">
                + {s.symbol}
              </button>
            ))}
            {notAdded.length === 0 && <div className="text-sm text-muted-foreground">Eklenecek hisse kalmadı.</div>}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((sym) => (
          <WatchlistCard key={sym} symbol={sym} onToggle={() => toggle(sym)} />
        ))}
        {list.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Star className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Takip listeniz boş. Yukarıdan hisse ekleyin.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
