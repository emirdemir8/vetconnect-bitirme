# Bitirme Projesi – Yazılı Döküm

Bu belge, veteriner ve evcil hayvan sahibi panelini kapsayan bitirme projesinin mimarisini, risk seviyeleri sistemini ve kullanım senaryolarını açıklar.

---

## 1. Genel Mimari

### 1.1 Bileşenler

- **Backend**: FastAPI tabanlı REST API. Kimlik doğrulama (JWT), rol tabanlı yetkilendirme (vet, pet_owner), CRUD ve raporlama endpoint’leri sunar.
- **Frontend**: React (Vite + TypeScript) ile geliştirilmiş tek sayfa uygulaması (SPA). İki ana bölüm vardır: **Vet Paneli** ve **Pet Owner Paneli**; kullanıcı rolüne göre yönlendirme yapılır.
- **Veritabanı**: MongoDB. Kullanıcılar, evcil hayvanlar, vakalar (cases), semptom raporları ve veteriner bilgi bankası (TigressADR tabanlı) koleksiyonları tutulur.

### 1.2 Rol Tabanlı Erişim

- **vet**: Veteriner paneli. Hastaları (pets) ve vakaları (cases) yönetir, risk analizi yapar, istatistikleri görür.
- **pet_owner**: Evcil hayvan sahibi paneli. Sadece kendi evcil hayvanlarını ve bu hayvanlara ait vakaları / semptom raporlarını görür.

Kayıt sırasında rol seçilir; giriş sonrası JWT içinde rol bilgisi taşınır. `ProtectedRoute` ve `require_role` ile sayfa ve API erişimi kısıtlanır.

### 1.3 API Katmanı (Özet)

| Alan        | Endpoint’ler (özet) |
|------------|----------------------|
| Auth       | `/auth/register`, `/auth/login` |
| Pets       | `GET/POST /pets`, `GET/PUT/DELETE /pets/{id}` (rol ile filtrelenir) |
| Cases      | `GET/POST /cases`, `GET/PUT /cases/{id}` (owner sadece kendi pet’lerine ait) |
| Stats      | `GET /stats/overview` (vet/admin) |
| Vet        | `POST /vet/check-serious`, `GET /vet/risk-terms` |
| Symptom reports | `GET/POST /symptom-reports` (owner kendi raporları) |

CORS, geliştirme ve production ortamlarına uygun şekilde yapılandırılır; frontend ve backend farklı portlarda çalışabilir.

---

## 2. Risk Seviyeleri Sistemi

### 2.1 Amaç

Sistem, TigressADR veri seti ve veteriner bilgi bankası (vet_knowledge_base) kullanılarak, girilen semptomlara veya serbest metne göre **risk seviyesi** ve **ciddiyet** (serious / not serious) değerlendirmesi yapar. Hem veteriner hem de evcil hayvan sahibi bu değerlendirmeyi kullanır.

### 2.2 Risk Seviyeleri (1–5)

| Seviye | Açıklama (özet) | Örnek terimler | Ciddi (serious) |
|--------|------------------|----------------|------------------|
| **1**  | Kritik alarm (en ciddi) | death, death by euthanasia, digestive tract haemorrhage, pneumonitis, hyponatremia | Evet |
| **2**  | Yüksek risk | dehydration, blood in faeces, myopathy, muscle wasting, infectious disease nos | Evet |
| **3**  | Orta derece | emesis, diarrhoea, mucous stool, hyperhidrosis | Hayır |
| **4**  | Sistemik / operasyonel risk | lack of efficacy, other abnormal test result | Hayır |
| **5**  | Hafif / lokal | injection site reactions, lethargy | Hayır |

**Ciddi (serious)** kabul edilen seviyeler: 1 ve 2. Diğer seviyeler “not serious” olarak işaretlenir; eşleşme yoksa sonuç belirsiz olabilir.

### 2.3 Çalışma Mantığı

1. **Girdi**: Semptom listesi (tag veya virgülle ayrılmış) ve/veya serbest metin (free text). İsteğe bağlı: hayvan türü, şüpheli ürün/aşı, ADRNo.
2. **Eşleştirme**:  
   - Açık semptom listesi, tanımlı risk terimleri ve bilgi bankasındaki alanlarla (SOC, LLT, HLT, PT vb.) eşleştirilir.  
   - Serbest metinden anlam çıkarılır (örn. “vomiting” → emesis); eşanlamlılar ve risk terimleri ile tetiklenen seviyeler hesaplanır.
3. **Sonuç**: En ciddi tetiklenen seviye döndürülür; `risk_level` (1–5), `risk_label`, `serious` (true/false), eşleşen semptomlar ve gerekçeler (reasons) frontend’e iletilir.

### 2.4 Kullanıldığı Yerler

- **Vet Paneli – Risk Analizi**: Veteriner semptom girer; risk seviyesi ve referans metinleri görür.  
- **Vet Paneli – Vakalar**: Yeni vaka oluşturulurken veya vaka güncellenirken semptomlar gönderilir; backend risk hesaplar ve vakayı kaydeder. Detay sayfasında “Re-run risk analysis” ile tekrar hesaplama yapılabilir.  
- **Pet Owner Paneli – Semptom Bildir / Ön Kontrol**: Sahip, evcil hayvanı seçip semptom veya serbest metin girer; sonuç “sade bir dille” (örn. “Seviye 3 … en kısa sürede veterinerinize başvurmanız önerilir”) gösterilir. Rapor kaydedilir ve Geçmiş’te listelenir.

---

## 3. Kullanım Senaryoları

### 3.1 Veteriner Senaryosu

1. Giriş: Vet hesabı ile `/login` → Vet paneline yönlendirilir.
2. **Dashboard**: Toplam vaka, ciddi vaka ve bugün açılan vaka sayıları; son vakalar tablosu; günün randevuları ve hasta kayıtları özeti.
3. **Hastalar (Pets)**: Tüm hasta kayıtlarını listeleme, arama (isim/tür/ırk), yeni hasta ekleme/düzenleme, aşı geçmişi.
4. **Vakalar (Cases)**: Vaka listesi (filtre: ciddi/risk/pet/tarih), vaka detayı (semptomlar, ADRNo, risk seviyesi, vet notları, tedavi planı), not güncelleme ve “Re-run risk analysis”.
5. **Risk Analizi**: Semptom tag girişi, serbest metin, ADRNo; analiz sonucu ve seviye 1–5 referans metinleri.

### 3.2 Evcil Hayvan Sahibi Senaryosu

1. Giriş: Pet owner hesabı ile `/login` → Owner paneline yönlendirilir.
2. **Evcil Hayvanlarım**: Kendi pet’lerini listeleme, ekleme/düzenleme (isim, tür, ırk, yaş, notlar, aşı bilgisi).
3. **Semptom Bildir / Ön Kontrol**: Pet seçimi, semptom veya serbest metin girişi, ön kontrole gönder. Sistem risk seviyesine göre sade dilde uyarı/öneri gösterir (örn. “Kritik risk … en kısa sürede veterinerinize başvurun”). Rapor otomatik kaydedilir.
4. **Geçmiş**: Semptom raporları (tarih, risk etiketi, veteriner geri bildirimi) ve veterinerin açtığı vakaların özeti (vaka no, evcil hayvan adı, risk, durum, semptomlar).

### 3.3 Ortak Noktalar

- JWT ile oturum; token frontend’de saklanır (örn. localStorage); 401 durumunda login sayfasına yönlendirme.  
- API dokümantasyonu: Swagger (`/docs`).  
- Hata ve yükleme durumları arayüzde gösterilir; form validasyonları ve rol kontrolleri uygulanır.

---

## 4. Teknik Notlar

- **Frontend**: Vite, React, TypeScript, React Router, Ant Design, Axios. Merkezi `apiClient` (JWT header, hata yönetimi, baseURL).  
- **Backend**: FastAPI, Pydantic, MongoDB (PyMongo). `get_current_user` ve `require_role` ile korumalı endpoint’ler.  
- **Risk hesaplama**: `routes/vet.py` ve `app/utils/risk_from_text.py`; bilgi bankası `vet_knowledge_base` koleksiyonunda.

Bu döküm, bitirme projesinin mimari, risk seviyeleri ve kullanım senaryoları açısından referans dokümanı olarak kullanılabilir.
