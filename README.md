# TPB Monorepo — UNU Purwokerto

Monorepo untuk situs resmi Program Studi Teknik Pertanian & Biosistem UNU Purwokerto.

| Aplikasi | Keterangan |
|---|---|
| `apps/web` | Frontend React 19 + Vite 8 + Tailwind v4 |
| `apps/api` | REST API NestJS 11 + Prisma + MySQL 8.0, prefix `/v1` |
| `packages/contracts` | Tipe & skema Zod bersama (frontend ↔ backend) |
| `tools/supabase-migration` | Tooling migrasi data Supabase KV → MySQL |
| `.github/workflows` | CI (GitHub Actions) + deploy via aaPanel Webhook |

---

## Prasyarat

| Tool | Versi minimum | Keterangan |
|---|---|---|
| Node.js | ≥ 20 (rekomendasi 22) | Runtime JavaScript |
| pnpm | ≥ 9 | Jalankan `corepack enable` terlebih dahulu |
| Docker | — | Untuk MySQL 8.0 lokal, atau gunakan MySQL sendiri |

---

## Environment

Salin setiap contoh environment ke file lokal/server yang sesuai. **Jangan pernah commit file `.env`.**

| File contoh | Isi |
|---|---|
| `apps/api/.env.example` | `NODE_ENV`, `PORT`, `DATABASE_URL`, JWT access secret & TTL, CORS allowlist, refresh-cookie settings, `MEDIA_DIR`, upload limit, `TRUST_PROXY` |
| `apps/web/.env.example` | Hanya `VITE_API_URL` (publik); jangan pernah simpan rahasia di variabel `VITE_*` |
| `tools/supabase-migration/.env.example` | Supabase service-role key (khusus migrasi) dan MySQL URL |

### Variabel wajib produksi

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | URL koneksi MySQL, contoh: `mysql://user:pass@host:3306/db` |
| `CORS_ORIGINS` | Domain frontend yang diizinkan (dipisah koma) |
| `JWT_ACCESS_SECRET` | Minimal 32 karakter, contoh: `openssl rand -hex 48` |
| `COOKIE_SECURE` | `true` untuk produksi (HTTPS) |
| `MEDIA_DIR` | Path absolut yang dapat ditulis, persisten di luar direktori rilis |
| `TRUST_PROXY` | `false`, `true`, atau jumlah hop proxy tepercaya |
| `COOKIE_DOMAIN` | Opsional; hanya jika domain hosting memerlukannya |
| `VITE_API_URL` | URL API berversi, contoh: `https://api.tpb.unupurwokerto.ac.id/v1` (bukan localhost) |

### Kebijakan pemulihan database

Pemulihan database hanya melalui **forward-fix** — jangan edit atau hapus migration yang sudah diterapkan. Sebelum deploy migration, ambil backup MySQL normal dari host dan catat tag rilis. Jika migration atau rilis gagal:

- Pertahankan proses aplikasi sebelumnya jika memungkinkan.
- Pulihkan database hanya melalui prosedur backup tim hosting yang sudah diuji jika integritas data mengharuskan.
- Buat migration korektif baru untuk pemulihan maju.
- Verifikasi `pnpm db:migrate:deploy` dan `/v1/health` sebelum membuka kembali lalu lintas.

Media yang diunggah harus dicadangkan secara terpisah dari MySQL karena berada di `MEDIA_DIR`.

---

## Setup Pengembangan

```bash
# 1. Jalankan MySQL 8.0 via Docker
docker compose up -d db

# 2. Salin file environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — isi JWT secret: openssl rand -hex 48
cp apps/web/.env.example apps/web/.env

# 3. Instal dependensi & jalankan migrasi database
pnpm install
pnpm --filter @tpb/api prisma:migrate

# 4. Jalankan aplikasi
pnpm dev:api    # http://localhost:3000/v1
pnpm dev:web    # http://localhost:5173
```

### Perintah database

```bash
pnpm prisma:generate              # Generate Prisma Client
pnpm db:migrate                   # Buat & terapkan migration development
pnpm db:migrate:create -- nama    # Buat migration baru tanpa menerapkan
pnpm db:migrate:deploy            # Terapkan migration yang sudah direview (staging/production)
```

- `db:migrate` — membuat dan menerapkan migration development.
- `db:migrate:deploy` — hanya untuk migration yang sudah direview pada staging/production.
- Sistem ini **tidak memiliki seeder** berisi data institusi atau data palsu. Bootstrap admin dilakukan melalui halaman `/#admin` saat tabel user kosong.

---

## Deployment via aaPanel Webhook

Deployment dilakukan melalui **aaPanel Webhook** — tidak ada akses SSH dari GitHub Actions.

### Alur deployment

| Trigger | Tujuan | Alur |
|---|---|---|
| Push ke branch `develop` | Staging | GitHub Actions → POST webhook → aaPanel jalankan script deploy |
| Push tag `v*` | Production | GitHub Actions → approval manual → POST webhook → aaPanel jalankan script deploy |

### Konfigurasi webhook di aaPanel

Buka **Website → Webhooks** (atau Plugin Webhooks) di aaPanel, lalu masukkan script bash berikut. Script ini dijalankan otomatis oleh aaPanel setiap kali GitHub Actions memanggil URL webhook.

**Script staging** (trigger: push ke `develop`):

```bash
set -e
cd /path/to/repo
git fetch origin develop
git checkout --force develop
git reset --hard origin/develop
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="https://staging-api.example.test/v1" pnpm --filter @tpb/web build
pm2 reload ecosystem.config.cjs --only tpb-api --update-env || pm2 start ecosystem.config.cjs --env production
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1:3000/v1/health
```

**Script production** (trigger: tag `v*`, memerlukan approval manual):

```bash
set -e
cd /path/to/repo
git fetch --tags && git checkout <tag>
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="https://api.example.test/v1" pnpm --filter @tpb/web build
pm2 reload ecosystem.config.cjs --only tpb-api --update-env || pm2 start ecosystem.config.cjs --env production
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1:3000/v1/health
```

> Ganti `/path/to/repo` dengan path absolut direktori repositori di peladen. Ganti `VITE_API_URL` dengan URL API target yang sebenarnya.

### GitHub Secrets

Konfigurasi di **Settings → Secrets and variables → Actions**:

| Secret | Keterangan |
|---|---|
| `AAPANEL_STAGING_WEBHOOK_URL` | URL webhook aaPanel untuk staging |
| `AAPANEL_PRODUCTION_WEBHOOK_URL` | URL webhook aaPanel untuk production |

### GitHub Environment Variables

Konfigurasi di **Settings → Environments**:

| Variabel | Environment | Keterangan |
|---|---|---|
| `STAGING_API_URL` | staging | URL API staging, contoh: `https://staging-api.example.test/v1` |
| `PROD_API_URL` | production | URL API production, contoh: `https://api.example.test/v1` |

> Environment `production` harus memiliki protection rule dengan **required reviewers** (approval manual).

### Server-side secrets

Sebelum start, sediakan nilai lengkap `apps/api/.env` di peladen:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | URL koneksi MySQL |
| `JWT_ACCESS_SECRET` | ≥ 32 karakter |
| `CORS_ORIGINS` | Domain frontend yang diizinkan |
| `COOKIE_SECURE` | `true` untuk produksi |
| `MEDIA_DIR` | Path absolut, dapat ditulis, persisten di luar direktori rilis |
| `TRUST_PROXY` | Konfigurasi proxy |

PM2 file tidak memuat rahasia — hosting harus menyuntikkan variabel ini sebelum PM2 start/reload.

Jalankan `pnpm api:preflight` dengan environment yang sama sebelum restart produksi untuk memastikan konfigurasi valid. Simpan `MEDIA_DIR` di luar direktori rilis agar pembersihan rilis tidak menghapus file yang diunggah.

---

## Konfigurasi Peladen

### aaPanel

1. Jalankan `bash <(curl -s https://www.aapanel.com/script/install-ubuntu-7.0_en.sh)` lalu ikuti wizard.
2. Setelah aaPanel aktif, instal **Plugin Website** atau **Webhooks** dari panel.
3. Buat script deploy di atas sebagai webhook script, lalu salin URL webhook-nya ke GitHub Secrets.

### Aplikasi yang harus diinstal via aaPanel

| Aplikasi | Cara instal |
|---|---|
| Node.js ≥ 20 | aaPanel → App Store → Node.js |
| pnpm | `npm install -g pnpm` |
| MySQL 8.0 | aaPanel → App Store → MySQL |
| PM2 | `npm install -g pm2` |

### Nginx

Konfigurasi Nginx melalui **aaPanel Site Manager**:

| Rute | Target |
|---|---|
| `/` | Sajikan `apps/web/dist` sebagai static site |
| `/v1/` | Proxy ke API NestJS pada port 3000 |
| `/media/` | Proxy ke API pada port 3000 (atau sajikan langsung dari `MEDIA_DIR`) |

Proxy harus meneruskan cookie dan header `Authorization`, serta mengatur HTTPS di sisi hosting.

### MEDIA_DIR

Pastikan direktori `MEDIA_DIR`:
- Dapat ditulis oleh proses Node.js
- Persisten dan berada di luar direktori rilis
- Dicadangkan secara terpisah dari database MySQL

---

## Alur Admin

1. Buka `/#admin` — selama tabel `users` (MySQL) kosong, form **Bootstrap Admin** muncul (sekali pakai; paritas gerbang "akun pertama" dari sistem lama).
2. Login → dashboard penuh: **Dashboard, Konten Situs, Berita, PMB, Galeri & Media, Pelanggan, Pengguna, Audit Log**.
3. **Konten Situs harus diisi dari dashboard** — situs publik menampilkan state "belum dikonfigurasi" sampai konten tersimpan di database. Tidak ada fallback/default content di kode (kebijakan: *tidak boleh ada data static inline / fallback / hardcode menempel di file code*).

---

## Migrasi Data dari Supabase

```bash
cd tools/supabase-migration

# Export data dari Supabase
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<key> pnpm export

# Import ke MySQL (idempoten)
pnpm import

# Verifikasi: bandingkan jumlah + checksum
pnpm reconcile
```

Service-role key **hanya** melalui variabel environment — tidak pernah masuk repo, tidak pernah diekspos ke frontend.

---

## Struktur Otentikasi

| Komponen | Detail |
|---|---|
| Access token | JWT, 15 menit, di memori frontend, header `Authorization: Bearer` |
| Refresh token | 30 hari, httpOnly cookie `tpb_refresh`; disimpan di database sebagai hash SHA-256, rotasi saat dipakai, revocation di logout |
| Role | `ADMIN` (semua akses), `EDITOR` (konten & berita), `OPERATOR` (PMB & galeri) |
| Bootstrap admin | Hanya tersedia saat tabel `users` kosong |

---

## Arsitektur CI/CD

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ci.yml (setiap push & PR)                        │   │
│  │  · contracts build → lint → audit:env             │   │
│  │  · prisma generate & validate                     │   │
│  │  · MySQL wait (2 fasa) → migrate → unit tests     │   │
│  │  · API smoke test → migration verify              │   │
│  │  · typecheck → build api → build web              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────┐  ┌───────────────────────────┐│
│  │ deploy-staging.yml   │  │ deploy-production.yml     ││
│  │ push → develop       │  │ push tag v*               ││
│  │ → POST webhook       │  │ → approval manual         ││
│  │ → aaPanel deploy     │  │ → POST webhook            ││
│  │                      │  │ → aaPanel deploy           ││
│  └──────────────────────┘  └───────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Peladen (aaPanel)                      │
│                                                          │
│  aaPanel Webhook → Script bash:                          │
│    git pull → pnpm install → db:migrate:deploy           │
│    → build contracts → build api → build web             │
│    → pm2 reload → curl health check                      │
│                                                          │
│  Nginx:                                                  │
│    /       → apps/web/dist (static)                      │
│    /v1/    → API NestJS :3000                            │
│    /media/ → API NestJS :3000                            │
└─────────────────────────────────────────────────────────┘
```

---

## Lisensi

Proprietary — hak cipta milik UNU Purwokerto.
