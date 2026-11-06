# Stockbear ilk beta yayın planı

Tarih: 6 Kasım 2026. İncelenen temel: `890434bf383e90036bf0e4262edcae3436d71c3e`.

Amaç: Kullanıcı bir BIST hissesini bulabilsin, kaynağı ve zamanı belli fiyatı ile gerçek geçmiş grafiğini inceleyebilsin ve takip listesine ekleyebilsin. Veri sağlanamadığında örnek fiyat veya üretilmiş grafik güncel veri olarak gösterilmesin.

## İkinci uygulama sonucu — 6 Kasım 2026

- Ana motor ve tarayıcıya gerçek yüksek/düşük/hacim verisi bağlandı; 50 mum altındaki girişler ve bozuk OHLCV reddediliyor.
- Yıllık volatilite günlük log getirilerinden, 252 işlem günü varsayımıyla hesaplanıyor.
- Teknik puan başarı olasılığı olarak gösterilmiyor. MAPE ve değerlendirme örnek sayısı açık; ölçülemeyen ufuklarda sayı üretilmiyor. 5 ve 20 işlem günü gibi gerçek tahmin ufukları korunuyor.
- Backtest hedef gününe hizalandı. Geçmiş veriyle tahmin, sonraki seans açılışında işlem ve çakışmayan beş günlük dönemlerle strateji getirisi hesaplanıyor; al-tut aynı dönemde ayrı gösteriliyor. Masraflar dahil değil.
- Sabit %55 başarı varsayımına dayalı Kelly pozisyonu ve dönemleri uyuşmayan Sharpe hesabı kaldırıldı.
- AI tablosu/kartlarındaki global hisseler artık sağlayıcının para birimiyle gösteriliyor; AAPL için USD tarayıcıda doğrulandı.
- 72 test geçti. TypeScript ve üretim build geçti. Bu tur değişen dosyalar biçimlendirme kuralı hariç lint kontrolünde temiz.
- PWA yanlış klasör uyarısı ve worker'ın SSR/Nitro sırasında tekrar yazılması giderildi; worker üretimi yalnızca istemcide çalışıyor. HTTP Content-Length ile dosya boyutunun eşleştiği doğrulandı. SSR uygulamasına tarayıcı kaydı eklendi.
- **Açık:** Uygulama içi tarayıcıdaki çevrimdışı geçiş testi hâlâ başarıyla doğrulanamadı. Bu özellik tamamlanmış/yayına hazır sayılmıyor; Chrome/Edge üzerinde kayıt, önbellek kurulumu ve bağlantı kesintisi ayrıca incelenmeli.
- Yerel uygulama 4321 portunda çalışıyor. Üretime dağıtım veya GitHub'a push yapılmadı. Sonraki yayın işi: kalan PWA tarayıcı doğrulaması, beta kapsamı ve aktif barındırma hedefinin kontrolü.

## İlk uygulama sonucu — 6 Kasım 2026

- Fiyat/grafik ekranlarında sessiz örnek fiyat ve üretilmiş grafik dönüşü kaldırıldı.
- Kaynak ve İstanbul saatinde sağlayıcı zamanı gösteriliyor; hata/kısmi sonuç durumları açık. Kısmi yenilemede önceki fiyat kendi zamanıyla korunuyor.
- Sembol/aralık/limit doğrulaması, timeout, istek birleştirme, sınırlı eşzamanlılık ve tarama süresi sınırı eklendi. Geçmişte gelecekteki fiyatla boşluk doldurma kaldırıldı.
- Örnek F/K ve piyasa değeri gösterimleri kaldırıldı. Fiyatları eksik portföyde toplam kâr/zarar ve CSV dışa aktarımı engellendi.
- Standart Windows build komutu düzeltildi.
- `npm test`: 61 test geçti. `npx tsc --noEmit` ve `npm run build` geçti. `git diff --check` geçti.
- Değişen TypeScript dosyalarında biçimlendirme kuralı hariç lint kontrolü hata vermedi; AppShell'de önceden mevcut Fast Refresh uyarısı kaldı. Tam lint hâlâ çoğunlukla mevcut biçimlendirme borcu nedeniyle başarısız.
- Canlı THYAO fiyatı ve 65 mumluk geçmiş veri doğrulandı. Tarayıcıda normal hisse, bilinmeyen sembolde açık hata, takip kaydının yenilemede korunması ve 390×844 mobil görünüm kontrol edildi. Eklenen GARAN test kaydı kaldırıldı.
- Yayın yapılmadı. Sonraki iş beta kapsamını uygulamak ve önizleme dağıtımını hazırlamak. AI metriklerinin doğrulanması, PWA uyarısı ve gerçek yayın hedefinin doğrulanması açık kalıyor.

## Başlangıç durumu

- Yerel üretim sunucusu: http://127.0.0.1:4321 (sunucu işlemi çalıştığı sürece).
- `/`, `/piyasa`, `/analiz?symbol=THYAO`, `/grafik?symbol=THYAO`, `/portfoy`, `/takip`, `/ai`, `/alarm` HTTP 200 verdi. Bu kontrol tarayıcı etkileşimini veya dış veri servislerini doğrulamaz.
- Önceki incelemede 45 test ve `npx tsc --noEmit` geçti.
- `npm run build` Windows'ta Linux biçimindeki ortam değişkeni ataması yüzünden başarısız. PowerShell ortam değişkenleri ile `npx vite build` tamamlandı.
- PWA build çıktısında precache dizini uyuşmazlığı uyarısı var; offline çalışma doğrulanmadı.
- Lint çoğunlukla biçimlendirme nedeniyle başarısız; anlamsal hatalar ayrıca ele alınmalı.
- Üretime dağıtım yapılmadı. Depoda Render/Docker yapılandırması var; GitHub metadata'sında Vercel adresi bulunuyor. Aktif yayın hedefi henüz doğrulanmadı.

## İlk uygulanacak iş: güvenilir fiyat ve grafik akışı

**Sonuç:** Piyasa → Hisse Analiz/Teknik Grafik → Takip Listem akışında kullanıcı hangi verinin mevcut, eski veya alınamamış olduğunu anlayabilir.

**Örnek:** Veri servisi geçerli fiyat ve geçmiş döndürdüğünde, kullanıcı THYAO'yu açınca doğru sembol, kaynak zaman damgası ve gerçek geçmiş grafiği görünür; takip listesine ekleyip sayfayı yenileyince kayıt korunur.

**Hata örneği:** Veri servisi başarısız olduğunda örnek fiyatlar veya `genLine` çıktısı piyasa verisi yerine gösterilmez. Son başarılı veri varsa zamanı ve yenileme hatası belirtilir; yoksa veri alınamadı mesajı ve tekrar deneme görünür. Başka bir hissenin fiyatı gösterilmez.

**Kısmi veri örneği:** Birden fazla hisseden bazılarının fiyatı alınamazsa mevcut sonuçlar korunur, eksik hisseler belirtilir; başarısız hisselere sıfır fiyat atanmaz.

**Kapsam:** `src/lib/ai.functions.ts`, `src/lib/market-data.ts`, `src/lib/useLivePrice.ts`; tüketiciler `src/routes/{index,piyasa,analiz,grafik,takip,screener,portfoy,alarm,rapor,karsilastir,ai}.tsx` ve ortak gösterimler `src/components/AppShell.tsx`, `src/components/AiAnalysisTable.tsx`. `fetchSingleStock`, `fetchStockHistory`, `fetchBistData` çağrıları ve paylaşılan sorgu anahtarları birlikte kontrol edilir. Yeni veri sözleşmesinin testleri kapsam içindedir; üretilen route dosyaları elle düzenlenmez.

Yapılacaklar:

1. Fiyatın veri kaynağını ve sağlayıcı zamanını taşıyan, boş/kısmi/başarısız yanıtları ayırt eden veri sözleşmesi kur.
2. Sembol, geçmiş aralığı ve sonuç limitini çalışma zamanında doğrula. Küçük limit için tüm listeyi sorgulama; eşzamanlı istekleri sınırla ve dış çağrılara timeout uygula.
3. Finansal ekranlardaki sessiz örnek veri dönüşünü kaldır; statik isim/sembol listesini fiyat verisinden ayır. Bilinmeyen sembol başka hisseye dönüşmesin.
4. Örnek F/K ve piyasa değeri gerçek fiyatla karıştırılmasın; doğrulanmış temel veri yoksa bu alanları ve onlara bağlı filtreleri kullanılamaz göster.
5. Gerçek geçmiş yoksa boş grafik göster. Yenileme hatasında önceki verinin zamanını koru; ağ hatasını başarılı boş yanıt gibi yutma.
6. Ana sayfa, piyasa, analiz, grafik ve takip listesinde masaüstü/mobil akışı doğrula.

**Ayırt edici kontrol:** Bugün servis kesilince örnek fiyat/grafik görülebiliyor. İş tamamlandığında aynı kesinti açık hata durumuna dönüşmeli; yanlış/örnek fiyat gösterilmemeli. Otomatik testler geçerli yanıt, timeout, bozuk yanıt, kısmi yanıt ve bilinmeyen sembolü kapsamalı. Canlı sağlayıcı kontrolü ayrıca yapılmalı; fixture testleri bunun kanıtı sayılmaz.

## Beta kapsamı ve sonraki işler

Önerilen ilk beta kapsamı ana sayfa, piyasa, gerçek geçmiş grafik, doğrulanmış teknik göstergeler ve cihazda saklandığı açıklanan takip listesidir. Mevcut diğer özelliklerin kapatılması bu planda bir öneridir; henüz uygulanmadı.

| Sıra | İş | Tamamlanma ölçütü |
| --- | --- | --- |
| 1 | Yukarıdaki fiyat ve grafik akışı | Başarı, servis kesintisi ve kısmi yanıt uçtan uca doğru görünür. |
| 2 | Yayın kapsamını uygulama | Doğrulanmamış AI güven yüzdeleri, strateji getirisi, simülasyon ve arka plan alarmı vaatleri ilk beta akışında yer almaz. AI açık kalacaksa gerçek OHLCV, metrik düzeltmeleri ve doğrulama önce tamamlanır. |
| 3 | Tekrarlanabilir kurulum ve build | Windows/Linux build komutları çalışır; seçilen sunucu hedefinde başlangıç ve health check geçer. README ve ortam örneği mevcut mimariyi anlatır. PWA ya doğrulanır ya beta için devre dışı bırakılır. |
| 4 | Önizleme ve yayın | Aktif barındırma hesabı/projesi doğrulanır; ayrı önizlemede gerçek veri, doğrudan sayfa açma, mobil kullanım ve hata durumları kontrol edilir. Geçerli sürüme geri dönüş yolu belirlenerek beta yayınlanır. |

Hız için yeni veritabanı, hesaplar arası senkronizasyon, ödeme sistemi, barındırma taşıması veya yeni model entegrasyonu ilk beta kapsamına alınmaz. Portföy tutulacaksa yerel saklama açıkça anlatılmalı ve fiyat eksikken yanıltıcı toplam kâr/zarar gösterilmemelidir.

## Süre ve yayın kararı

Dar kapsamlı beta için ilk tahmin **2–4 yoğun çalışma günü**; bu bir teslim taahhüdü değildir. Veri sağlayıcısının üretim ortamında erişilebilirliği ve mevcut yayın hesabına erişim henüz doğrulanmadığı için süre değişebilir. Tüm mevcut özelliklerin doğrulanarak açık tutulması bu tahmine dahil değildir.

Yayın için aşağıdakilerin tamamı sağlanmalı:

- Normal build komutu ve başlangıç komutu seçilen ortamda geçiyor.
- Mevcut testler, yeni hata senaryoları ve TypeScript kontrolü geçiyor; ilgili lint hataları giderilmiş.
- Gerçek sağlayıcıdan fiyat ve geçmiş alınabiliyor; zaman ve kaynak gösteriliyor. “Gerçek zamanlı” iddiası ayrıca doğrulanmadıkça kullanılmıyor.
- API kesintisi, kısmi sonuç ve doğrudan bağlantıyla açılış test edildi.
- Mobil arama → analiz → takip listesi → yenileme akışı tarayıcıda geçti.
- Önizleme kontrol edildi; yayın hedefi, önceki sürüm ve geri dönüş işlemi biliniyor.

Sonraki ürün işi: Gerçek OHLCV ile AI motorunu düzeltmek, güven skorunu doğru adlandırmak ve model stratejisini al-tut karşılaştırmasıyla ölçmek. Hesap bazlı saklama ve sunucu taraflı alarmlar bundan sonra ayrı işlerdir.

## Sonraki oturum için not — 7 Kasım 2026

Çalışma dalı: `codex/reliable-market-data`.

- Son doğrulama: 72 test, TypeScript kontrolü ve üretim derlemesi geçti. Tam lintte mevcut biçimlendirme borcu sürüyor.
- Öncelik: PWA çevrimdışı geçişini Chrome/Edge üzerinde incelemek. Worker tek kez üretiliyor ve sunucunun dosya boyutu doğru; uygulama içi tarayıcıdaki kesinti denemesi henüz geçmedi.
- Ardından beta kapsamını uygulamak ve mevcut Vercel/Render yayın hedefini doğrulamak. Üretime dağıtım yapılmadı.
- AI geçmiş testleri masraf öncesi deneysel karşılaştırmadır; gelecekteki başarıya ilişkin kalibrasyon yapılmadı.
