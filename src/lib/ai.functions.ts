import { createServerFn } from "@tanstack/react-start";
import { SECTOR_MAP } from "./market-data";

import { z } from "zod";
import { createYahooClient, parseQuote, parseHistory, collectQuotes, stockInput, historyInput, batchInput, type MarketQuote } from "./market-feed";

const yfFetch = createYahooClient();
const parseMeta = parseQuote;

// ─── Market Indexes ─────────────────────────────────────────────────────────

type IndexData = {
  source: "Yahoo Finance";
  asOf: string;
  fetchedAt: string;
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  prevClose: number;
  high: number;
  low: number;
};

const INDEX_SYMBOLS: { name: string; symbol: string }[] = [
  { name: "BIST 100", symbol: "XU100.IS" },
  { name: "S&P 500", symbol: "^GSPC" },
  { name: "NASDAQ", symbol: "^IXIC" },
  { name: "DOLAR/TL", symbol: "USDTRY=X" },
  { name: "ALTIN", symbol: "GC=F" },
  { name: "EUR/TRY", symbol: "EURTRY=X" },
];

export const fetchIndexes = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    const results = await Promise.allSettled(
      INDEX_SYMBOLS.map(async (idx) => {
        const result = await yfFetch(idx.symbol);
        const meta = parseMeta(result);
        if (!meta) return null;
        const change = meta.price - meta.prevClose;
        const changePercent = meta.prevClose ? (change / meta.prevClose) * 100 : 0;
        return {
          source: meta.source,
          asOf: meta.asOf,
          fetchedAt: meta.fetchedAt,
          name: idx.name,
          symbol: idx.symbol,
          value: meta.price,
          change,
          changePercent,
          prevClose: meta.prevClose,
          high: meta.high,
          low: meta.low,
        } as IndexData;
      }),
    );
    const indexes = results
      .filter((r): r is PromiseFulfilledResult<IndexData | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean) as IndexData[];
    if (!indexes.length) throw new Error("Endeks verisi alınamadı.");
    return indexes;
  });

// ─── BIST Stocks (Genişletilmiş) ───────────────────────────────────────────

export type StockData = MarketQuote & { sector: string };

export const BIST_SYMBOLS = ["A1CAP","A1YEN","AAGYO","ACSEL","ADEL","ADESE","ADGYO","AEFES","AFYON","AGESA","AGHOL","AGROT","AGYO","AHGAZ","AHSGY","AKBNK","AKCNS","AKENR","AKFGY","AKFIS","AKFYE","AKGRT","AKHAN","AKMGY","AKSA","AKSEN","AKSGY","AKSUE","AKYHO","ALARK","ALBRK","ALCAR","ALCTL","ALFAS","ALGYO","ALKA","ALKIM","ALKLC","ALTNY","ALVES","ANELE","ANGEN","ANHYT","ANSGR","ARASE","ARCLK","ARDYZ","ARENA","ARFYE","ARMGD","ARSAN","ARTMS","ARZUM","ASELS","ASGYO","ASTOR","ASUZU","ATAGY","ATAKP","ATATP","ATATR","ATEKS","ATLAS","ATSYH","AVGYO","AVHOL","AVOD","AVPGY","AVTUR","AYCES","AYDEM","AYEN","AYES","AYGAZ","AZTEK","BAGFS","BAHKM","BAKAB","BALAT","BALSU","BANVT","BARMA","BASCM","BASGZ","BAYRK","BEGYO","BERA","BESLR","BESTE","BEYAZ","BFREN","BIENY","BIGCH","BIGEN","BIGTK","BIMAS","BINBN","BINHO","BIOEN","BIZIM","BJKAS","BLCYT","BLUME","BMSCH","BMSTL","BNTAS","BOBET","BORLS","BORSK","BOSSA","BRISA","BRKO","BRKSN","BRKVY","BRLSM","BRMEN","BRSAN","BRYAT","BSOKE","BTCIM","BUCIM","BULGS","BURCE","BURVA","BVSAN","BYDNR","CANTE","CASA","CATES","CCOLA","CELHA","CEMAS","CEMTS","CEMZY","CEOEM","CGCAM","CIMSA","CLEBI","CMBTN","CMENT","CONSE","COSMO","CRDFA","CRFSA","CUSAN","CVKMD","CWENE","DAGI","DAPGM","DARDL","DCTTR","DENGE","DERHL","DERIM","DESA","DESPC","DEVA","DGATE","DGGYO","DGNMO","DIRIT","DITAS","DMRGD","DMSAS","DNISI","DOAS","DOCO","DOFER","DOFRB","DOGUB","DOHOL","DOKTA","DSTKF","DUNYH","DURDO","DURKN","DYOBY","DZGYO","EBEBK","ECILC","ECOGR","ECZYT","EDATA","EDIP","EFOR","EGEEN","EGEGY","EGEPO","EGGUB","EGPRO","EGSER","EKDMR","EKGYO","EKIZ","EKOS","EKSUN","ELITE","EMKEL","EMNIS","EMPAE","ENDAE","ENERY","ENJSA","ENKAI","ENPRA","ENSRI","ENTRA","EPLAS","ERBOS","ERCB","EREGL","ERSU","ESCAR","ESCOM","ESEN","ETILR","ETYAT","EUHOL","EUKYO","EUPWR","EUREN","EUYO","EYGYO","FADE","FENER","FLAP","FMIZP","FONET","FORMT","FORTE","FRIGO","FRMPL","FROTO","FZLGY","GARAN","GARFA","GATEG","GEDIK","GEDZA","GENIL","GENKM","GENTS","GEREL","GESAN","GIPTA","GLBMD","GLCVY","GLRMK","GLRYH","GLYHO","GMTAS","GOKNR","GOLDA","GOLTS","GOODY","GOZDE","GRNYO","GRSEL","GRTHO","GSDDE","GSDHO","GSRAY","GUBRF","GUNDG","GWIND","GZNMI","HALKB","HATEK","HATSN","HDFGS","HEDEF","HEKTS","HKTM","HLGYO","HOROZ","HRKET","HTTBT","HUBVC","HUNER","HURGZ","ICBCT","ICUGS","IDGYO","IEYHO","IHAAS","IHEVA","IHGZT","IHLAS","IHLGM","IHYAY","IMASM","INDES","INFO","INGRM","INTEK","INTEM","INVEO","INVES","ISATR","ISBIR","ISBTR","ISCTR","ISDMR","ISFIN","ISGSY","ISGYO","ISKPL","ISKUR","ISMEN","ISSEN","ISYAT","IZENR","IZFAS","IZINV","IZMDC","JANTS","KAPLM","KAREL","KARSN","KARTN","KATMR","KAYSE","KBORU","KCAER","KCHOL","KENT","KERVN","KFEIN","KGYO","KIMMR","KLGYO","KLKIM","KLMSN","KLNMA","KLRHO","KLSER","KLSYN","KLYPV","KMPUR","KNFRT","KOCMT","KONKA","KONTR","KONYA","KOPOL","KORDS","KOTON","KRDMA","KRDMB","KRDMD","KRGYO","KRONT","KRPLS","KRSTL","KRTEK","KRVGD","KSTUR","KTLEV","KTSKR","KUTPO","KUVVA","KUYAS","KZBGY","KZGYO","LIDER","LIDFA","LILAK","LINK","LKMNH","LMKDC","LOGO","LRSHO","LUKSK","LXGYO","LYDHO","LYDYE","MAALT","MACKO","MAGEN","MAKIM","MAKTK","MANAS","MARBL","MARKA","MARMR","MARTI","MAVI","MCARD","MEDTR","MEGAP","MEGMT","MEKAG","MEPET","MERCN","MERIT","MERKO","METRO","MEYSU","MGROS","MHRGY","MIATK","MMCAS","MNDRS","MNDTR","MOBTL","MOGAN","MOPAS","MPARK","MRGYO","MRSHL","MSGYO","MTRKS","MTRYO","MZHLD","NATEN","NETAS","NETCD","NIBAS","NTGAZ","NTHOL","NUGYO","NUHCM","OBAMS","OBASE","ODAS","ODINE","OFSYM","ONCSM","ONRYT","ORCAY","ORGE","ORMA","ORZAX","OSMEN","OSTIM","OTKAR","OTTO","OYAKC","OYAYO","OYLUM","OYYAT","OZATD","OZGYO","OZKGY","OZRDN","OZSUB","OZYSR","PAGYO","PAHOL","PAMEL","PAPIL","PARSN","PASEU","PATEK","PCILT","PEKGY","PENGD","PENTA","PETKM","PETUN","PGSUS","PINSU","PKART","PKENT","PLTUR","PNLSN","PNSUT","POLHO","POLTK","PRDGS","PRKAB","PRKME","PRZMA","PSDTC","PSGYO","QNBFK","QNBTR","QUAGR","RALYH","RAYSG","REEDR","RGYAS","RNPOL","RODRG","RTALB","RUBNS","RUZYE","RYGYO","RYSAS","SAFKR","SAHOL","SAMAT","SANEL","SANFM","SANKO","SARKY","SASA","SAYAS","SDTTR","SEGMN","SEGYO","SEKFK","SEKUR","SELEC","SELVA","SERNT","SEYKM","SILVR","SISE","SKBNK","SKTAS","SKYLP","SKYMD","SMART","SMRTG","SMRVA","SNGYO","SNICA","SNPAM","SODSN","SOHOE","SOKE","SOKM","SONME","SRVGY","SUMAS","SUNTK","SURGY","SUWEN","SVGYO","TABGD","TARKM","TATEN","TATGD","TAVHL","TBORG","TCELL","TCKRC","TDGYO","TEHOL","TEKTU","TERA","TEZOL","TGSAS","THYAO","TKFEN","TKNSA","TLMAN","TMPOL","TMSN","TNZTP","TOASO","TRALT","TRCAS","TRENJ","TRGYO","TRHOL","TRILC","TRMET","TSGYO","TSKB","TSPOR","TTKOM","TTRAK","TUCLK","TUKAS","TUPRS","TUREX","TURGG","TURSG","UCAYM","UFUK","ULAS","ULKER","ULUFA","ULUSE","ULUUN","UNLU","USAK","VAKBN","VAKFA","VAKFN","VAKKO","VANGD","VBTYZ","VERTU","VERUS","VESBE","VESTL","VKFYO","VKGYO","VKING","VRGYO","VSNMD","YAPRK","YATAS","YAYLA","YBTAS","YEOTK","YESIL","YGGYO","YIGIT","YKBNK","YKSLN","YONGA","YUNSA","YYAPI","YYLGD","ZEDUR","ZERGY","ZGYO","ZOREN","ZRGYO"];

// Global & US Stocks + ETFs (NasDaq, S&P, Europe, Funds)
export const GLOBAL_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX", "AMD", "INTC", 
  "QCOM", "AVGO", "CSCO", "ADBE", "CRM", "PEP", "KO", "MCD", "NKE", "JPM", "BAC", "V", "MA",
  "ASML", "SAP", "NVO", "LVMUY", "TTE", "SNY", "NVS", "BABA", "TSM",
  "SPY", "QQQ", "DIA", "IWM", "GLD", "SLV", "USO", "ARKK", "VTI", "VOO",
  "IBIT", "FBTC", "MSTR", "COIN"
];

function formatYfSymbol(sym: string): string {
  if (GLOBAL_SYMBOLS.includes(sym)) return sym;
  return sym.includes(".") ? sym : `${sym}.IS`;
}

export const fetchBistData = createServerFn({ method: "GET" })
  .validator((input: unknown) => batchInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const symbols = data.limit > 0 ? BIST_SYMBOLS.slice(0, data.limit) : BIST_SYMBOLS;
    return collectQuotes(symbols, async (symbol): Promise<StockData> => {
      const quote = parseMeta(await yfFetch(formatYfSymbol(symbol)), formatYfSymbol(symbol));
      return { ...quote, symbol, sector: SECTOR_MAP[symbol] || "Diğer" };
    });
  });

export const fetchSingleStock = createServerFn({ method: "GET" })
  .validator((input: unknown) => stockInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const symbol = formatYfSymbol(data.symbol);
    return parseMeta(await yfFetch(symbol), symbol);
  });

export const fetchStockHistory = createServerFn({ method: "GET" })
  .validator((input: unknown) => historyInput.parse(input ?? {}))
  .handler(async ({ data }) => parseHistory(await yfFetch(formatYfSymbol(data.symbol), data.range)));

// ─── News (RSS -> JSON proxy) ──────────────────────────────────────────────

type NewsItem = {
  id: number;
  title: string;
  source: string;
  time: string;
  url: string;
  tag: string;
  impact: "high" | "medium" | "low";
  thumbnail?: string;
};

export const fetchNews = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const obj = input as { symbol?: string };
    return { symbol: (obj?.symbol || "").toUpperCase() };
  })
  .handler(async ({ data }) => {
    try {
      const queries = ["borsa piyasa", "bist hisse", "türkiye ekonomi"];
      if (data.symbol) {
        queries.unshift(`${data.symbol} hisse`);
      }
      const allItems: Array<{
        title: string;
        publisher: string;
        link: string;
        providerPublishTime: number;
        thumbnail?: { resolutions: Array<{ url: string }> };
      }> = [];

      for (const q of queries) {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotes_count=0&news_count=10&lang=tr-TR`,
            { headers: { "User-Agent": "Mozilla/5.0" } },
          );
          if (res.ok) {
            const json = await res.json();
            if (json.news) allItems.push(...json.news);
          }
        } catch (e) { console.warn("News fetch error:", e); }
      }

      // Tekrarlanan haberleri temizle
      const seen = new Set<string>();
      const unique = allItems.filter((n) => {
        if (seen.has(n.title)) return false;
        seen.add(n.title);
        return true;
      });

      if (unique.length === 0) return getFallbackNews();

      return unique.slice(0, 30).map((n, i): NewsItem => ({
        id: i + 1,
        title: n.title,
        source: n.publisher,
        time: timeAgo(n.providerPublishTime * 1000),
        url: n.link,
        tag: guessTag(n.title),
        impact: guessImpact(n.title),
        thumbnail: n.thumbnail?.resolutions?.[0]?.url,
      }));
    } catch (e) {
      console.warn("fetchNews error:", e);
      return getFallbackNews();
    }
  });

function getFallbackNews(): NewsItem[] {
  return [
    { id: 1, title: "Piyasalar güncel verileri bekliyor", source: "stockbear", time: "şimdi", url: "#", tag: "Piyasa", impact: "medium" },
    { id: 2, title: "BIST 100 endeksi işlem görüyor", source: "stockbear", time: "şimdi", url: "#", tag: "BIST", impact: "medium" },
  ];
}

function timeAgo(dateMs: number): string {
  const diff = Date.now() - dateMs;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

function guessTag(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("faiz") || t.includes("tcmb")) return "Ekonomi";
  if (t.includes("bist") || t.includes("endeks")) return "BIST";
  if (t.includes("dolar") || t.includes("euro") || t.includes("kur")) return "Döviz";
  if (t.includes("altın") || t.includes("emtia")) return "Emtia";
  if (t.includes("abd") || t.includes("fed")) return "Global";
  return "Piyasa";
}

function guessImpact(title: string): "high" | "medium" | "low" {
  const t = title.toLowerCase();
  if (t.includes("faiz") || t.includes("tcmb") || t.includes("enflasyon") || t.includes("tarım")) return "high";
  if (t.includes("bist") || t.includes("endeks") || t.includes("kar")) return "medium";
  return "low";
}

// ─── Economic Calendar ──────────────────────────────────────────────────────

type CalendarEvent = {
  date: string;
  time: string;
  event: string;
  country: string;
  impact: "high" | "medium" | "low";
  forecast: string;
  previous: string;
};

export const fetchCalendar = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    try {
      const res = await fetch(
        "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
        { headers: { "User-Agent": "Mozilla/5.0" } },
      );
      if (!res.ok) return getFallbackCalendar();
      const json = await res.json();
      const items = json as Array<{
        title: string;
        date: string;
        country: string;
        impact: string;
        forecast: string;
        previous: string;
      }>;
      if (!items || items.length === 0) return getFallbackCalendar();
      return items.slice(0, 20).map((e): CalendarEvent => ({
        date: formatDate(e.date),
        time: new Date(e.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        event: e.title,
        country: countryFlag(e.country),
        impact: e.impact === "High" ? "high" : e.impact === "Medium" ? "medium" : "low",
        forecast: e.forecast || "-",
        previous: e.previous || "-",
      }));
    } catch (e) {
      console.warn("fetchCalendar error:", e);
      return getFallbackCalendar();
    }
  });

function getFallbackCalendar(): CalendarEvent[] {
  const now = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    return {
      date: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
      time: "10:00",
      event: "Veri yükleniyor...",
      country: "🌍",
      impact: "medium" as const,
      forecast: "-",
      previous: "-",
    };
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function countryFlag(code: string): string {
  const flags: Record<string, string> = {
    US: "🇺🇸", TR: "🇹🇷", EU: "🇪🇺", GB: "🇬🇧", DE: "🇩🇪", JP: "🇯🇵", CN: "🇨🇳",
  };
  return flags[code] || "🌍";
}

// ─── AI Engine Integration ──────────────────────────────────────────────────

import { runAIEngine, runSimpleTechnicalEngine } from "./ml.engine";

// Fetch history and run ML engine for a single stock
export const fetchSingleAiAnalysis = createServerFn({ method: "GET" })
  .validator((input: unknown) => stockInput.extend({ dataCount: z.number().int().min(50).max(1250).default(252) }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const chart = await yfFetch(formatYfSymbol(data.symbol), "5y");
    const history = parseHistory(chart);
    const analysis = await runAIEngine(history, data.symbol, data.dataCount, parseMeta(chart).currency);
    return { symbol: data.symbol, analysis };
  });

// Fetch history and run Simple Technical Engine for all symbols (AL/SAT only)
// Uses v8 chart API with concurrency-limited parallel fetches
export const fetchTechnicalSignals = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    const bist = BIST_SYMBOLS.slice(0, 80).map((s) => `${s}.IS`);
    const allSymbols = Array.from(new Set([...bist, ...GLOBAL_SYMBOLS]));
    const results: { symbol: string; currency: string; analysis: { decision: string; rawScore: number; currentPrice: number } }[] = [];
    
    let loadedCount = 0;
    const CONCURRENCY = 10;
    for (let i = 0; i < allSymbols.length; i += CONCURRENCY) {
      const batch = allSymbols.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (fullSymbol) => {
          const sym = fullSymbol.replace(".IS", "");
          const chart = await yfFetch(fullSymbol, "3mo");
          const history = parseHistory(chart);
          loadedCount++;
          if (history.length < 50) return null;
          const analysis = runSimpleTechnicalEngine(history, sym);
          if (analysis.decision === "AL" || analysis.decision === "SAT") {
            return { symbol: sym, currency: parseMeta(chart).currency, analysis };
          }
          return null;
        })
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value) results.push(r.value);
      }
    }
    
    if (!loadedCount) throw new Error("Teknik sinyal verisi alınamadı.");
    results.sort((a, b) => b.analysis.rawScore - a.analysis.rawScore);
    return results;
  });

// ─── Kronos Foundation Model Prediction ─────────────────────────────────────

export const fetchKronosPrediction = createServerFn({ method: "GET" })
  .validator((input: unknown) => stockInput.extend({ predDays: z.number().int().min(1).max(120).default(14) }).parse(input ?? {}))
  .handler(async ({ data }) => {
    try {
      const yfSym = formatYfSymbol(data.symbol);
      const KRONOS_API = "https://demolifted-kronos-market-forecast.hf.space/api/predict";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(KRONOS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "yahoo",
          symbol: yfSym,
          interval: "1d",
          horizon: data.predDays,
          model: "small", // "small" model is faster
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Bilinmeyen hata");
        console.warn(`[Kronos] API hatası (${response.status}):`, errorText);
        return { symbol: data.symbol, error: `API hatası: ${response.status}`, predictions: [] };
      }

      const json = await response.json();
      
      // json format: { context: [...], forecast: { candles: [...], p10: [...], p90: [...] } }
      if (!json.forecast || !json.forecast.candles) {
        return { symbol: data.symbol, error: "Beklenmeyen API yanıtı", predictions: [] };
      }

      const candles = z.array(z.object({ time: z.number().finite(), open: z.number().finite().positive(), high: z.number().finite().positive(), low: z.number().finite().positive(), close: z.number().finite().positive() })).parse(json.forecast.candles);

      const predictions = candles.map((c) => ({
        timestamp: new Date(c.time * 1000).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      return {
        symbol: data.symbol,
        model: "Kronos-small",
        predictions,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn("[Kronos] fetchKronosPrediction hatası:", errorMsg);
      return { symbol: data.symbol, error: errorMsg, predictions: [] };
    }
  });
