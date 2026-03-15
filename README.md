# VetConnect – Veteriner ve Evcil Hayvan Sahibi Paneli

Veteriner kliniği ve evcil hayvan sahipleri için rol tabanlı web uygulaması. Backend (FastAPI) ve frontend (React SPA) tek proje altında yer alır.

## Hızlı başlangıç

- **Backend**: `pip install -r requirements.txt` → `uvicorn app.main:app --reload` (varsayılan port 8000)
- **Frontend**: `cd frontend` → `npm install` → `npm run dev` (varsayılan port 5173)
- **Veritabanı**: MongoDB; bağlantı bilgisi `app/core/config.py` içinde.

## Mimari ve risk seviyeleri

**Mimari**, **risk seviyeleri sistemi** ve **kullanım senaryoları** için ayrıntılı yazılı döküm:

→ **[BITIRME_DOKUMANTASYON.md](./BITIRME_DOKUMANTASYON.md)**

Bu belgede şunlar açıklanır:

- Genel mimari (backend, frontend, veritabanı, rol tabanlı erişim)
- Risk seviyeleri (1–5) ve ciddiyet (serious) mantığı, TigressADR entegrasyonu
- Veteriner ve evcil hayvan sahibi kullanım senaryoları

## API dokümantasyonu

Backend çalışırken: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (Swagger UI).

---

## Telefonda açma (aynı Wi‑Fi)

Bilgisayarında proje çalışırken, **telefon ve bilgisayar aynı Wi‑Fi’de** olmalı.

1. **Bilgisayarının yerel IP’sini bul**  
   PowerShell: `ipconfig`  
   **Wi-Fi** veya **Ethernet** bölümünde **IPv4 Adresi** (örn. `192.168.1.45`).

2. **Backend** (bilgisayarda, 1. terminal):
   ```powershell
   cd "proje\BITIRME"
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

3. **Frontend – ağdan erişilebilir** (bilgisayarda, 2. terminal):
   ```powershell
   cd "proje\BITIRME\frontend"
   npm run dev:host
   ```
   Çıktıda **Network:** satırında bir adres görünecek (örn. `http://192.168.1.45:5173`).

4. **Telefonda:** Tarayıcıyı aç, bu adresi yaz (örn. `http://192.168.1.45:5173`).  
   Giriş yapıp uygulamayı kullanabilirsin.

---

## Projeyi paylaşma

### 1) GitHub / GitLab ile (önerilen)

1. [GitHub](https://github.com) veya [GitLab](https://gitlab.com) hesabı aç.
2. Yeni bir repository oluştur (örn. `vetconnect-bitirme`).
3. Proje klasöründe terminal açıp:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/repo-adi.git
git push -u origin main
```

4. Repo linkini arkadaşına gönder. O da **Code → Download ZIP** veya `git clone https://github.com/...` ile indirir.

### 2) ZIP ile

Proje klasörünü ZIP’le; `frontend/node_modules`, `__pycache__`, `.venv` ekleme (arkadaş kendi bilgisayarında `pip install` ve `npm install` yapacak). ZIP’i Drive veya e-posta ile gönder.

### 3) OneDrive ile

- Proje zaten OneDrive’da ise klasöre sağ tık → **Paylaş** → arkadaşının e-postasını yaz veya **Bağlantıyı kopyala** de. Arkadaş indirir veya doğrudan klasörde çalışır.

### Arkadaşının yapması gerekenler

1. **MongoDB** kurulu ve çalışır olmalı (veya `app/core/config.py` içindeki bağlantı ayarları güncellenmeli).
2. **Backend:** `pip install -r requirements.txt` → `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
3. **Frontend:** `cd frontend` → `npm install` → `npm run dev`
4. Tarayıcıda çıkan adresi aç (örn. http://localhost:5173).
