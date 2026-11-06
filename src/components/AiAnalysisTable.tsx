import { useQuery } from "@tanstack/react-query";
import { fetchTechnicalSignals } from "@/lib/ai.functions";
import { RefreshCw, Target, Info, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AiAnalysisTable() {
  const { data, isLoading, refetch, isFetching, isError } = useQuery({
    queryKey: ["ai-top-analysis"],
    queryFn: () => fetchTechnicalSignals({}),
    retry: false,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  type SortKey = "symbol" | "decision" | "price";
  const [sortKey, setSortKey] = useState<SortKey | null>("decision");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedData = useMemo(() => {
    if (!data) return [];
    
    // Zaten AL ve SAT filtreli geliyor, ama garanti olsun
    const arr = data.filter((row: { symbol: string; analysis: { decision: string; rawScore: number } }) => row.analysis.decision === "AL" || row.analysis.decision === "SAT");
    
    if (sortKey) {
      arr.sort((a, b) => {
        let av: string | number, bv: string | number;
        switch (sortKey) {
          case "symbol": av = a.symbol; bv = b.symbol; break;
          case "decision": 
            av = a.analysis.rawScore; 
            bv = b.analysis.rawScore; 
            break;
          case "price": av = a.analysis.currentPrice; bv = b.analysis.currentPrice; break;
          default: return 0;
        }
        if (typeof av === "string" && typeof bv === "string") {
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
      });
    }
    return arr;
  }, [data, sortKey, sortAsc]);

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

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Sinyal Fırsat Tablosu</h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm inline-flex items-center gap-2 hover:border-primary/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Güncelleniyor..." : "Yenile"}
        </button>
      </div>

      {isError && <p role="alert" className="text-sm text-destructive mb-3">Sinyal verisi yenilenemedi. Önceki sonuçlar varsa güncel olmayabilir.</p>}
      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
        <Info className="w-4 h-4" />
        Piyasadaki 100+ hissenin Destek/Direnç, RSI, SMA gibi temel teknik göstergelere göre hızlı günlük taraması.
      </p>

      {isLoading ? (
        <div className="flex justify-center p-8 text-muted-foreground animate-pulse">
          Piyasa Taranıyor (100+ Hisse)...
        </div>
      ) : (
        <TooltipProvider>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-sm relative">
              <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-card z-10 shadow-sm">
                <tr>
                  <th className="text-left font-medium pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort("symbol")}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1">
                          Hisse <Info className="w-3 h-3" /> <SortIcon k="symbol" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>BIST piyasasında işlem gören hissenin kısa sembolüdür.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-center font-medium pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort("decision")}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center gap-1">
                          Durum (Puan) <Info className="w-3 h-3" /> <SortIcon k="decision" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-center">
                          Yapay Zeka ve Teknik indikatörlerin ürettiği AL veya SAT kararıdır.<br/>
                          Yanındaki puan sinyalin gücünü belirtir.<br/>
                          70 ve üzeri AL, 30 ve altı SAT sinyali üretir.<br/>
                          Tıklayarak güçlüden zayıfa sıralayabilirsiniz.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="text-right font-medium pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort("price")}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-end gap-1">
                          Fiyat <Info className="w-3 h-3" /> <SortIcon k="price" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Hissenin analiz anındaki son güncel fiyatıdır.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData && sortedData.length > 0 ? (
                  sortedData.map((row) => (
                    <tr key={row.symbol} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="py-3">
                        <Link to="/analiz" search={{ symbol: row.symbol }} className="font-bold hover:text-primary transition-colors">
                          {row.symbol}
                        </Link>
                      </td>
                      <td className="text-center py-3">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 ${
                          row.analysis.decision === "AL" ? "bg-[color:var(--success)]/20 text-[color:var(--success)]" :
                          "bg-destructive/20 text-destructive"
                        }`}>
                          {row.analysis.decision}
                          <span className="opacity-70 font-medium">({row.analysis.rawScore.toFixed(0)} Puan)</span>
                        </span>
                      </td>
                      <td className="text-right py-3 text-xs font-bold">
                        {row.analysis.currentPrice.toFixed(2)} {row.currency}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center p-4 text-muted-foreground text-xs">
                      Analiz üretilemedi veya belirgin bir sinyal yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

