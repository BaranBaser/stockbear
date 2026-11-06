type Props = {
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  hasData?: boolean;
  asOf?: string;
  unavailableSymbols?: string[];
  onRetry?: () => void;
  label?: string;
};

export function MarketDataStatus({
  isLoading,
  isFetching,
  isError,
  hasData,
  asOf,
  unavailableSymbols = [],
  onRetry,
  label = "Fiyat zamanı",
}: Props) {
  return (
    <div
      role={isError || unavailableSymbols.length ? "alert" : "status"}
      className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground my-3"
    >
      {isLoading ? (
        "Piyasa verisi yükleniyor…"
      ) : isError ? (
        <span className="text-destructive">
          Veri yenilenemedi.{" "}
          {hasData
            ? "Son başarılı veriler gösteriliyor; güncel olmayabilir."
            : "Fiyat verisi alınamadı."}
        </span>
      ) : !hasData ? (
        "Gösterilecek piyasa verisi bulunamadı."
      ) : (
        "Kaynak: Yahoo Finance. Veriler gecikmeli olabilir."
      )}
      {asOf && (
        <div className="mt-1">
          {label}:{" "}
          <time dateTime={asOf}>
            {new Date(asOf).toLocaleString("tr-TR", {
              timeZone: "Europe/Istanbul",
            })}
          </time>{" "}
          (İstanbul)
        </div>
      )}
      {unavailableSymbols.length > 0 && (
        <div className="text-destructive mt-1">
          Alınamayan hisseler ({unavailableSymbols.length}):{" "}
          {unavailableSymbols.join(", ")}. Önceki verisi olan hisseler kendi
          zamanlarıyla korunur.
        </div>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isFetching}
          className="underline ml-2 disabled:opacity-50"
        >
          {isFetching ? "Yenileniyor…" : "Yenile"}
        </button>
      )}
    </div>
  );
}
