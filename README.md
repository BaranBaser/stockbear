# stockbear

Yapay zeka destekli BIST hisse analiz platformu. Zaman damgalı Yahoo Finance verileri (gecikmeli olabilir), makine öğrenmesi tabanlı teknik analiz ve profesyonel raporlama.

## Tech Stack

- **Frontend**: TanStack Start (React 19 + Vite + Nitro)
- **Analiz**: TypeScript teknik analiz motoru ve harici Kronos servisi
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts, lightweight-charts
- **Auth**: Firebase Auth (isteğe bağlı)
- **Deploy**: Docker + Render

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev          # Varsayılan: http://localhost:3000
```

## Build

```bash
npm run build
npm run preview
```

## Test

```bash
npx vitest run
```

## Tip Kontrolü

```bash
node_modules/.bin/tsc --noEmit
```

## Ortam Değişkenleri

`.env` dosyası oluşturun (`.env.example` şablon olarak kullanılabilir):

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API anahtarı | Hayır (boşsa auth devre dışı) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Hayır |
| `VITE_FIREBASE_PROJECT_ID` | Firebase proje ID | Hayır |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Hayır |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging ID | Hayır |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Hayır |

## Mimari

```
stockbear/
├── src/
│   ├── routes/          # Sayfa bileşenleri (TanStack Router)
│   ├── components/      # Yeniden kullanılabilir bileşenler
│   ├── lib/             # Yardımcı fonksiyonlar, API çağrıları, ML motoru
│   └── assets/          # Görseller
├── Dockerfile           # Production build
└── render.yaml          # Render deploy config
```

## Özellikler

- **Fiyat Verisi**: Yahoo Finance fiyatları, sağlayıcı zamanı, kısmi sonuç ve yenileme hatası gösterimi
- **Teknik Analiz**: RSI, MACD, Bollinger Bantları, Stokastik, ADX, CCI, ATR, OBV, VWAP
- **AI Sinyalleri**: Ridge Regression, Momentum, Mean Reversion, EMA modelleri ile AL/SAT/BEKLE sinyalleri
- **Portföy Takibi**: Pozisyon ekleme, kâr/zarar hesaplama, sektör dağılımı
- **Hisse Karşılaştırma**: 2-4 hisse arasında karşılaştırmalı analiz
- **Haberler**: Yahoo Finance haberleri, duygu analizi ile
- **Alarm Sistemi**: Fiyat alarmı, tarayıcı bildirimleri
- **Grafik**: TradingView tarzı candlestick grafik
- **Screener**: Filtreleme ile hisse tarama
- **Rapor**: PNG/PDF olarak profesyonel analiz raporu
- **PWA**: Yüklenebilir uygulama yapılandırması ve statik varlık önbelleği; fiyatlar ağ bağlantısı gerektirir. Çevrimdışı geçişin tarayıcı doğrulaması açık.

## Lisans

MIT

## Beta geliştirme durumu

`npm run build` Windows ve Linux üzerinde Node tabanlı build komutunu kullanır.
Yerel üretim sürümünü başlatmak için önce build alın, sonra `npm start` çalıştırın.
PowerShell üzerinde özel port için `$env:PORT='4321'; $env:HOST='127.0.0.1'; npm start` kullanılabilir.

Fiyatlar ve grafikler servis hatasında örnek veriye dönmez. Son başarılı fiyatlar
sayfa açıkken sorgu önbelleğinde tutulur ve kendi sağlayıcı zamanlarıyla gösterilir;
tarayıcı kapalıyken fiyat takibi yapılmaz. Hacim lot/adet cinsindedir.
F/K ve piyasa değeri bu fiyat servisinden sağlanmadığı için örnek sayılar kullanılmaz.

`npm test` birim ve sunucu handler testlerini HTTP taşımasından ayrı çalıştırır.
Fixture testleri canlı sağlayıcı kontrolünün yerini tutmaz.

Yayın kapsamı ve kalan kontroller için [RELEASE_PLAN.md](RELEASE_PLAN.md).
Analiz hesaplarının birim testleri geçmektedir; modelin gelecekteki başarısı için kalibrasyon yapılmamıştır. PWA çevrimdışı geçişinin tarayıcı doğrulaması henüz tamamlanmamıştır.

## Analiz ve geçmiş test metodolojisi

- Ana analiz ve teknik tarama en az 50 geçerli günlük OHLCV mumu kullanır. Gün içi yüksek/düşük fiyatlar kapanıştan türetilmez.
- Yıllık volatilite, son en fazla 60 günlük logaritmik getirinin örnek standart sapmasının `sqrt(252)` ile çarpılmasıdır. 252 işlem günü varsayılır.
- Teknik puan 0–100 arası yön puanıdır; başarı olasılığı değildir. Gelecek fiyat bantları sezgisel aralıklardır, kalibre edilmiş güven aralıkları değildir.
- MAPE, geçmiş tahminlerin ortalama mutlak yüzde hatasıdır. Yeterli geçmiş değerlendirme noktası olmayan ufuklarda hata puanı yerine eksik test bilgisi gösterilir.
- Backtest her tahmin için yalnızca o tarihe kadar bilinen mumları kullanır. Beş işlem günlük çakışmayan dönemlerde yükseliş tahmininde sonraki seansın açılışında alım, hedef günün kapanışında çıkış varsayılır; aksi halde nakitte beklenir. Al-tut getirisi aynı başlangıç/bitiş aralığıyla karşılaştırılır. Komisyon, kayma, vergi ve temettü dahil değildir.
- Doğrulanmış başarı oranı olmadan Kelly pozisyon yüzdesi veya dönemleri uyuşmayan verilerden Sharpe oranı üretilmez.
- AI tablosu ve analiz kartları fiyatın sağlayıcı para birimini taşır.

PWA worker yalnızca istemci derlemesinde üretilir. SSR/Nitro derlemesinde tekrar üretim, statik dosya boyutu bilgisini bozabileceği için engellenmiştir. Çevrimdışı fiyat verisi sunulmaz.
