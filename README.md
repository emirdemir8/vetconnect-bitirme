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

**Otomatik (önerilen):** Proje klasöründe (BITIRME) PowerShell açıp şunu çalıştır:

```powershell
.\ZIP_OLUSTUR.ps1
```

Masaüstünde `BITIRME_paylasim.zip` oluşur; bunu arkadaşına gönder.

**Elle ZIP alacaksan**, ZIP’e **ekleme** (çıkart):

| Çıkartılacak / eklenmeyecek |
|-----------------------------|
| `frontend\node_modules`     |
| `frontend\dist`            |
| Tüm `__pycache__` klasörleri |
| `.venv` veya `venv` (varsa) |
| `.git` (Git kullanmayacaksa) |
| `.idea`, `.vscode`, `.cursor` |

Bu klasörler çok yer kaplar; arkadaş kendi bilgisayarında `pip install -r requirements.txt` ve `npm install` ile kuracak.

### 3) OneDrive ile

- Proje zaten OneDrive’da ise klasöre sağ tık → **Paylaş** → arkadaşının e-postasını yaz veya **Bağlantıyı kopyala** de. Arkadaş indirir veya doğrudan klasörde çalışır.

### Arkadaşının yapması gerekenler

1. **MongoDB** kurulu ve çalışır olmalı (veya `app/core/config.py` içindeki bağlantı ayarları güncellenmeli).
2. **Backend:** `pip install -r requirements.txt` → `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
3. **Frontend:** `cd frontend` → `npm install` → `npm run dev`
4. Tarayıcıda çıkan adresi aç (örn. http://localhost:5173).
