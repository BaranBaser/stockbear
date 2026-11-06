import { MarketDataStatus } from "@/components/MarketDataStatus";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAlarms, useAlarmHistory } from "@/lib/storage";
import { useServerFn } from "@tanstack/react-start";
import { fetchSingleStock } from "@/lib/ai.functions";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Trash2, Plus, TrendingUp, TrendingDown, BellRing } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/alarm")({
  head: () => ({
    meta: [
      { title: "Alarmlar — stockbear" },
      { name: "description", content: "Fiyat alarmları oluşturun, hedef fiyatlara ulaşıldığında bildirim alın." },
      { property: "og:title", content: "Alarmlar — stockbear" },
    ],
  }),
  component: AlarmPage,
});

function AlarmPage() {
  const { alarms, add, remove, toggle } = useAlarms();
  const { entries: alarmHistory, add: addHistory, clear: clearHistory } = useAlarmHistory();
  const [form, setForm] = useState({ symbol: "", type: "above" as "above" | "below", targetPrice: "" });
  const fetchSingle = useServerFn(fetchSingleStock);
  const [notifPermission, setNotifPermission] = useState<typeof Notification.permission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotification = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const sendNotification = (title: string, body: string) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  const { data: livePrices = {}, isError: priceError, isLoading: priceLoading, refetch: refreshPrices } = useQuery({
    queryKey: ["alarm-prices", alarms.map((a) => a.symbol).join(",")],
    queryFn: async () => {
      try {
        const prices: Record<string, number> = {};
        const uniqueSymbols = [...new Set(alarms.map((a) => a.symbol))];
        for (const sym of uniqueSymbols) {
          try {
            const result = await fetchSingle({ data: { symbol: sym } });
            if (result?.price) prices[sym] = result.price;
          } catch (e) { console.warn("Alarm price fetch error:", sym, e); }
        }
        if (uniqueSymbols.length && !Object.keys(prices).length) throw new Error("Alarm fiyatları alınamadı.");
        return prices;
      } catch (e) { console.warn("alarmPriceFetch error:", e); throw e; }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: alarms.length > 0,
    retry: false,
    throwOnError: false,
  });

  const lastTriggeredRef = useRef<Record<string, number>>({});

  // Alarm tetikleme kontrolü ve bildirim gönderimi (cooldown: 30 dk)
  useEffect(() => {
    if (priceError || !livePrices || Object.keys(livePrices).length === 0) return;
    const now = Date.now();
    const COOLDOWN_MS = 30 * 60 * 1000;
    for (const alarm of alarms.filter((a) => a.active)) {
      const price = livePrices[alarm.symbol];
      if (!price) continue;
      const triggered = alarm.type === "above" ? price >= alarm.targetPrice : price <= alarm.targetPrice;
      if (triggered) {
        const lastTime = lastTriggeredRef.current[alarm.id] || 0;
        if (now - lastTime < COOLDOWN_MS) continue;
        lastTriggeredRef.current[alarm.id] = now;
        sendNotification(
          `stockbear Alarm: ${alarm.symbol}`,
          `${alarm.symbol} fiyatı ${price.toFixed(2)} ₺ — Hedef: ${alarm.type === "above" ? "Üzeri" : "Altı"} ${alarm.targetPrice.toFixed(2)} ₺`
        );
        addHistory({
          symbol: alarm.symbol,
          type: alarm.type,
          targetPrice: alarm.targetPrice,
          triggeredPrice: price,
          triggeredAt: new Date().toISOString(),
        });
      }
    }
  }, [livePrices, alarms, addHistory, priceError]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.targetPrice);
    if (!form.symbol || !price) return;
    add({ symbol: form.symbol.toUpperCase(), type: form.type, targetPrice: price, active: true });
    setForm({ symbol: "", type: "above", targetPrice: "" });
  };

  const activeAlarms = alarms.filter((a) => a.active);
  const inactiveAlarms = alarms.filter((a) => !a.active);

  return (
    <AppShell>
      {alarms.length > 0 && <MarketDataStatus isError={priceError} isLoading={priceLoading} hasData={Object.keys(livePrices).length > 0} unavailableSymbols={[...new Set(alarms.map(a => a.symbol))].filter(s => !livePrices[s])} onRetry={() => refreshPrices()} />}
      <PageHeader
        title="Fiyat Alarmları"
        subtitle="Hisse fiyatlarını izleyin, hedef fiyatlara ulaştığında haberdar olun."
        action={
          typeof Notification !== "undefined" && notifPermission !== "granted" ? (
            <button onClick={requestNotification} className="bg-secondary border border-border rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2 hover:border-primary/40">
              <BellRing className="w-4 h-4" /> Bildirimlere İzin Ver
            </button>
          ) : undefined
        }
      />

      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-0">
          <label htmlFor="alarmSymbol" className="text-xs text-muted-foreground">Hisse</label>
          <input
            id="alarmSymbol"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
            placeholder="Örn: THYAO"
            className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm uppercase"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label htmlFor="alarmType" className="text-xs text-muted-foreground">Alarm Tipi</label>
          <select
            id="alarmType"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "above" | "below" })}
            className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="above">Fiyat Üzerine Çıkarsa</option>
            <option value="below">Fiyat Altına Düşerse</option>
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label htmlFor="alarmTarget" className="text-xs text-muted-foreground">Hedef Fiyat (TL)</label>
          <input
            id="alarmTarget"
            type="number"
            step="0.01"
            value={form.targetPrice}
            onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
            placeholder="0.00"
            className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Alarm Ekle
        </button>
      </form>

      {activeAlarms.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Aktif Alarmlar ({activeAlarms.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {activeAlarms.map((a) => {
              const livePrice = livePrices[a.symbol];
              const triggered = livePrice ? (a.type === "above" ? livePrice >= a.targetPrice : livePrice <= a.targetPrice) : false;
              return (
                <div key={a.id} className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/40 ${triggered ? "bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Link to="/analiz" search={{ symbol: a.symbol }} className="font-semibold hover:text-primary">{a.symbol}</Link>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${a.type === "above" ? "bg-[color:var(--success)]/10 text-[color:var(--success)]" : "bg-destructive/10 text-destructive"}`}>
                      {a.type === "above" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {a.type === "above" ? "Üzeri" : "Altı"}
                    </span>
                    <span className="text-sm text-muted-foreground">{a.targetPrice.toFixed(2)} TL</span>
                    {triggered && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Tetiklendi!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {livePrice && (
                      <span className={`text-sm font-medium ${livePrice >= a.targetPrice ? "text-[color:var(--success)]" : "text-destructive"}`}>
                        {livePrice.toFixed(2)} TL
                      </span>
                    )}
                    <button onClick={() => toggle(a.id)} aria-label="Alarmı devre dışı bırak" className="text-muted-foreground hover:text-primary">
                      <BellOff className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(a.id)} aria-label="Alarmı sil" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inactiveAlarms.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden opacity-60">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <BellOff className="w-4 h-4" />
              Pasif Alarmlar ({inactiveAlarms.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {inactiveAlarms.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-muted-foreground">{a.symbol}</span>
                  <span className="text-xs text-muted-foreground">{a.type === "above" ? "Üzeri" : "Altı"} {a.targetPrice.toFixed(2)} TL</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(a.id)} aria-label="Alarmı etkinleştir" className="text-muted-foreground hover:text-primary">
                    <Bell className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(a.id)} aria-label="Alarmı sil" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alarms.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Bell className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Henüz alarm eklenmemiş. Yukarıdan bir hisse için alarm ekleyin.</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            Alarm Geçmişi
          </h3>
          {alarmHistory.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-muted-foreground hover:text-destructive">Temizle</button>
          )}
        </div>
        {alarmHistory.length > 0 && (() => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const recentCount = alarmHistory.filter(e => new Date(e.triggeredAt) >= thirtyDaysAgo).length;
          return (
            <div className="px-4 py-2 border-b border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Son 30 günde <strong className="text-foreground">{recentCount}</strong> alarm tetiklendi</span>
              <span>Tetikleme oranı: <strong className="text-foreground">{alarms.length > 0 ? Math.round((alarmHistory.length / Math.max(alarms.length, 1)) * 100) : 0}%</strong></span>
            </div>
          );
        })()}
        {alarmHistory.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Henüz tetiklenen alarm yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">Tarih</th>
                  <th className="text-left px-4 py-2 font-medium">Hisse</th>
                  <th className="text-left px-4 py-2 font-medium">Tür</th>
                  <th className="text-right px-4 py-2 font-medium">Hedef</th>
                  <th className="text-right px-4 py-2 font-medium">Tetiklenen</th>
                  <th className="text-right px-4 py-2 font-medium">Fark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alarmHistory.slice(0, 20).map((entry) => {
                  const diff = entry.triggeredPrice - entry.targetPrice;
                  const isProfit = entry.type === "above" ? diff >= 0 : diff <= 0;
                  return (
                    <tr key={entry.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-2 text-muted-foreground">{new Date(entry.triggeredAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })} {new Date(entry.triggeredAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-2 font-semibold">{entry.symbol}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${entry.type === "above" ? "bg-[color:var(--success)]/10 text-[color:var(--success)]" : "bg-destructive/10 text-destructive"}`}>
                          {entry.type === "above" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {entry.type === "above" ? "Üzeri" : "Altı"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{entry.targetPrice.toFixed(2)} ₺</td>
                      <td className="px-4 py-2 text-right font-medium">{entry.triggeredPrice.toFixed(2)} ₺</td>
                      <td className={`px-4 py-2 text-right font-medium ${isProfit ? "text-[color:var(--success)]" : "text-destructive"}`}>
                        {diff >= 0 ? "+" : ""}{diff.toFixed(2)} ₺
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
        Alarmlar bu tarayıcıda saklanır ve yalnızca bu sayfa açıkken kontrol edilir. Canlı fiyatlar Yahoo Finance tarafından sağlanır.
      </div>
    </AppShell>
  );
}
