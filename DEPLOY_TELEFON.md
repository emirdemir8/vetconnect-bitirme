# Projeyi Telefonda (PC Olmadan) Çalıştırma

PC’yi kapatıp sadece telefondan kullanmak için projeyi **internete yayınlaman** (deploy) gerekir. Sonra telefonda tarayıcıdan açtığın linke girersin; bilgisayar açık olmak zorunda değildir.

---

## Ne yapılacak? (Özet)

1. **Veritabanı** → Bulutta (MongoDB Atlas, ücretsiz)
2. **Backend** → Bulutta (Render / Railway, ücretsiz plan)
3. **Frontend** → Bulutta (Vercel, ücretsiz)
4. **Telefon** → Tarayıcıda frontend linkini açıp giriş yaparsın

Hepsi ücretsiz planlarla yapılabilir.

---

## Adım 1: MongoDB Atlas (veritabanı)

1. https://www.mongodb.com/cloud/atlas → **Sign up** (ücretsiz).
2. **Create** → **Free** (M0) cluster seç, bölge seç, oluştur.
3. **Database Access** → Add user (kullanıcı adı + şifre). Rol: **Atlas admin** veya **Read and write to any database**.
4. **Network Access** → **Add IP** → **Allow access from anywhere** (0.0.0.0/0) → Confirm.
5. **Database** → **Connect** → **Drivers** → **Connection string** kopyala. Örnek:
   ```
   mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   `KULLANICI` ve `SIFRE` kısmını kendi kullanıcı adı ve şifrenle değiştir. Boşluk/özel karakter varsa şifreyi URL-encode et (örn. `@` → `%40`).
6. Bu metin **MONGO_URI** olacak; backend’i deploy ederken kullanacaksın. Veritabanı adı için `MONGO_DB=appdb` kullanabilirsin (connection string’in sonuna `/appdb` ekleyebilirsin).

---

## Adım 2: Backend’i yayınlama (Render örneği)

1. https://render.com → **Sign up** (GitHub ile giriş yapabilirsin).
2. **New** → **Web Service**.
3. Repo’yu bağla: **Connect** → GitHub’dan `vetconnect-bitirme` seç.
4. Ayarlar:
   - **Name:** `vetconnect-api` (veya istediğin)
   - **Root Directory:** boş (proje kökü)
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
5. **Environment** (Environment Variables) ekle:
   - `MONGO_URI` = Adım 1’de kopyaladığın connection string (şifre kısmı doğru olsun).
   - `MONGO_DB` = `appdb`
   - `JWT_SECRET` = Uzun, rastgele bir metin (örn. 32 karakter; güvenlik için önemli).
   - `CORS_ORIGINS` = Vercel frontend adresin (deploy sonrası ekle). Örn: `https://vetconnect-bitirme.vercel.app`
6. **Create Web Service** de. Birkaç dakika sonra **URL** verilir, örn: `https://vetconnect-api.onrender.com`. Bu adres **backend adresin**; frontend’i deploy ederken buna istek atacak.

Render’da CORS’u backend’den açman gerekebilir: `app/main.py` içinde `CORS_ORIGINS` listesine frontend’in deploy adresini ekle (örn. `https://vetconnect.vercel.app`). Bunu aşağıda “CORS” kısmında anlatıyorum.

---

## Adım 3: Frontend’i yayınlama (Vercel örneği)

1. https://vercel.com → **Sign up** (GitHub ile).
2. **Add New** → **Project** → GitHub’dan `vetconnect-bitirme` seç.
3. **Root Directory** → `frontend` olarak ayarla.
4. **Framework Preset:** Vite.
5. **Environment Variables** ekle:
   - **Name:** `VITE_API_URL`
   - **Value:** Backend adresi (örn. `https://vetconnect-api.onrender.com`) — **sondaki / yok**.
6. **Deploy** de. Bittiğinde bir URL verilir, örn: `https://vetconnect-bitirme.vercel.app`. Bu adres **uygulama adresin**; bunu telefonda açacaksın.

Render’da backend deploy olduktan sonra, **Environment**’a `CORS_ORIGINS` eklediysen (Vercel frontend adresi) CORS zaten açıktır. Proje `CORS_ORIGINS` ortam değişkenini okuyor; ek adres yoksa sadece localhost çalışır.

---

## Adım 4: Telefonda kullanım

- Telefonunda (Wi‑Fi veya mobil veri) tarayıcıyı aç (Chrome, Safari vb.).
- Adres çubuğuna **frontend adresini** yaz (Vercel’deki link, örn. `https://vetconnect-bitirme.vercel.app`).
- Açılan sayfadan giriş yap; uygulama artık PC olmadan telefonda çalışır.

---

## Özet

| Bileşen   | Nerede?        | Ne yaparsın? |
|----------|----------------|--------------|
| Veritabanı | MongoDB Atlas | Ücretsiz cluster, connection string alırsın. |
| Backend  | Render         | GitHub repo bağla, MONGO_URI + JWT_SECRET ver, deploy. |
| Frontend | Vercel         | `frontend` klasörü, VITE_API_URL = backend URL, deploy. |
| Telefon  | Tarayıcı       | Sadece frontend linkini açarsın. |

İlk kurulumu yine bir kez PC’de (veya Cursor’da) yaparsın; deploy bittikten sonra projeyi **sadece telefondan** kullanırsın, PC’yi açmana gerek kalmaz.
