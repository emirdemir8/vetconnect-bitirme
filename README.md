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


