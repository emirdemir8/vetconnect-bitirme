# Projeyi Git / GitHub ile Yükleme (Adım Adım)

## 1. Git kurulu mu?

PowerShell veya CMD açıp yaz:

```bash
git --version
```

Çıktı yoksa veya "tanınmıyor" derse Git’i indir: https://git-scm.com/download/win  
Kurulumu varsayılan ayarlarla bitir.

---

## 2. GitHub hesabı

- https://github.com → **Sign up** ile ücretsiz hesap aç.
- Giriş yap.

---

## 3. GitHub’da yeni repo oluştur

1. Sağ üst **+** → **New repository**
2. **Repository name:** `vetconnect-bitirme` (veya istediğin isim)
3. **Public** seç
4. **"Add a README file"** işaretleme (projede zaten var)
5. **Create repository** tıkla
6. Açılan sayfada **HTTPS** linkini kopyala, örneğin:  
   `https://github.com/KULLANICI_ADIN/vetconnect-bitirme.git`

---

## 4. Projeyi bilgisayarında Git’e bağla

**PowerShell** aç (Windows tuşu + X → "Windows PowerShell" veya "Terminal").

Sırayla şu komutları yaz (proje klasörüne gidip):

```powershell
cd "c:\Users\Emirhan\Documents\OneDrive - Haliç Üniversitesi\Masaüstü\BITIRME"
```

```powershell
git init
```

```powershell
git add .
```

```powershell
git status
```
(Bir sürü dosya listelenir; normal.)

```powershell
git commit -m "Ilk yukleme - VetConnect projesi"
```

---

## 5. GitHub repo’yu “uzak adres” olarak ekle ve gönder

**KULLANICI_ADIN** ve **vetconnect-bitirme** kısımlarını kendi GitHub kullanıcı adın ve repo adınla değiştir:

```powershell
git remote add origin https://github.com/KULLANICI_ADIN/vetconnect-bitirme.git
```

```powershell
git branch -M main
```

```powershell
git push -u origin main
```

İlk seferde GitHub kullanıcı adı ve **Personal Access Token** (şifre yerine) isteyebilir.  
Şifre isterse: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token** → repo yetkisi ver → token’ı kopyala, komutta şifre yerine yapıştır.

---

## 6. Arkadaşın nasıl indirir?

Linki gönder: `https://github.com/KULLANICI_ADIN/vetconnect-bitirme`

- **ZIP indirmek için:** Yeşil **Code** → **Download ZIP**
- **Git ile indirmek için:** Bilgisayarında `git clone https://github.com/KULLANICI_ADIN/vetconnect-bitirme.git` çalıştırır.

---

## Özet (tekrar)

| Adım | Komut / işlem |
|------|----------------|
| 1 | Git kur, GitHub hesabı aç |
| 2 | GitHub’da yeni repo oluştur, HTTPS linkini kopyala |
| 3 | `cd BITIRME` → `git init` → `git add .` → `git commit -m "Ilk yukleme"` |
| 4 | `git remote add origin https://github.com/.../repo.git` |
| 5 | `git branch -M main` → `git push -u origin main` |
| 6 | Repo linkini arkadaşına gönder |

Sonraki değişikliklerde sadece:

```powershell
git add .
git commit -m "Ne degistirdiysen kisa yaz"
git push
```

yeterli.
