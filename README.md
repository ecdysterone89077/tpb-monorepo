# TPB Monorepo — UNU Purwokerto

Monorepo privat untuk situs Program Studi Teknik Pertanian & Biosistem UNU Purwokerto:

- **`apps/web`** — Frontend React 19 + Vite 8 + Tailwind v4
- **`apps/api`** — REST API NestJS 11 + Prisma + MySQL 8.0, prefix `/v1` (target: `https://api.tpb.unupurwokerto.ac.id/v1`)
- **`packages/contracts`** — Tipe & skema request/response bersama (frontend ↔ backend)
- **`tools/supabase-migration`** — Tooling migrasi data Supabase KV → MySQL (export → transform → import → reconcile)
- **`.github/workflows`** — CI + deploy staging & production terpisah

## Prasyarat

- Node.js ≥ 20 (rekomendasi 22)
- pnpm ≥ 9 (`corepack enable`)
- Docker (MySQL 8.0 lokal) atau MySQL sendiri

## Environment

Salin setiap contoh environment ke file lokal/server yang sesuai. Jangan commit file `.env`:

- `apps/api/.env.example`: `NODE_ENV`, `PORT`, `DATABASE_URL`, JWT access secret/TTL, CORS allowlist, refresh-cookie settings, `MEDIA_DIR`, upload limit, and `TRUST_PROXY`.
- `apps/web/.env.example`: public `VITE_API_URL` only; never put secrets in `VITE_*` variables.
- `tools/supabase-migration/.env.example`: migration-only Supabase service-role key and MySQL URL. The service-role key is never used by the frontend.

Production must provide `DATABASE_URL`, `CORS_ORIGINS`, a strong `JWT_ACCESS_SECRET` (at least 32 characters), `COOKIE_SECURE=true`, a writable absolute `MEDIA_DIR`, and a correctly scoped `TRUST_PROXY` value (`false`, `true`, or a trusted proxy hop count). `COOKIE_DOMAIN` is optional and should only be set when the hosting domains require it. `VITE_API_URL` must be the versioned API origin/path for the target environment, for example `https://api.example.test/v1`; it must not be left at the localhost development value.

Database recovery is forward-fix only: do not edit or delete an applied migration. Before migration deployment, take the host's normal MySQL backup and record the release tag. If a migration or release fails, keep the previous application process running when possible, restore the database only through the hosting team's tested backup procedure when data integrity requires it, and create a new corrective migration for forward recovery. Verify `pnpm db:migrate:deploy` and `/v1/health` before reopening traffic. Uploaded media must be backed up separately from MySQL because it lives in `MEDIA_DIR`.

## Setup Pengembangan

```bash
# 1. Docker MySQL 8.0 lokal
docker compose up -d db

# 2. Environment
cp apps/api/.env.example apps/api/.env   # isi JWT secret: openssl rand -hex 48
cp apps/web/.env.example apps/web/.env

# 3. Instal dependensi & migrasi database
pnpm install
pnpm --filter @tpb/api prisma:migrate

# 4. Jalankan aplikasi
pnpm dev:api    # http://localhost:3000/v1
pnpm dev:web    # http://localhost:5173
```

### Perintah database satu baris

```bash
pnpm prisma:generate
pnpm db:migrate
pnpm db:migrate:create -- nama_migrasi
pnpm db:migrate:deploy
```

`db:migrate` membuat dan menerapkan migration development; `db:migrate:deploy` hanya untuk migration yang sudah direview pada staging/production. Sistem ini tidak memiliki seeder berisi data institusi atau data palsu; bootstrap admin dilakukan melalui halaman `/#admin` saat tabel user kosong.

### Handover hosting

Hosting team menyediakan Node.js ≥20, pnpm, MySQL 8.0, PM2 or another process manager, a persistent writable upload directory, and secrets environment. Deployment dilakukan via **aaPanel** tanpa akses SSH.

### aaPanel Webhook Deployment

Konfigurasi Webhook di aaPanel (Website → Webhooks atau Plugin Webhooks) dengan script bash berikut. Script ini dijalankan otomatis oleh aaPanel setiap kali GitHub Actions memanggil webhook URL.

**Staging** (triggered on push to `develop`):

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

**Production** (triggered on tag `v*`, requires manual approval):

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

### Secrets & Environment Variables

**GitHub Secrets** (dikonfigurasi di Settings → Secrets → Actions):

| Secret | Keterangan |
|---|---|
| `AAPANEL_STAGING_WEBHOOK_URL` | URL webhook aaPanel untuk staging |
| `AAPANEL_PRODUCTION_WEBHOOK_URL` | URL webhook aaPanel untuk production |

**GitHub Environment Variables** (dikonfigurasi di Settings → Environments):

| Variable | Environment | Keterangan |
|---|---|---|
| `STAGING_API_URL` | staging | URL API staging, contoh: `https://staging-api.example.test/v1` |
| `PROD_API_URL` | production | URL API production, contoh: `https://api.example.test/v1` |

Environment `production` harus memiliki protection rule dengan **required reviewers** (approval manual).

**Server-side secrets** (dikonfigurasi di aaPanel):

Sebelum start, provision complete `apps/api/.env` values: `DATABASE_URL`, `JWT_ACCESS_SECRET` (≥32 chars), `CORS_ORIGINS`, `COOKIE_SECURE=true`, `MEDIA_DIR` (absolute, writable, persistent di luar release directory), `TRUST_PROXY`. PM2 file tidak memuat rahasia — hosting harus inject variabel ini sebelum PM2 start/reload.

Run `pnpm api:preflight` with the same environment before a production restart to fail closed on invalid configuration. Keep `MEDIA_DIR` outside the release directory so a release cleanup cannot remove uploaded files.

Nginx via aaPanel Site Manager harus dikonfigurasi:

- `/` menyajikan `apps/web/dist` sebagai static site.
- `/v1/` meneruskan request ke API NestJS pada port 3000.
- `/media/` meneruskan request ke API pada port 3000 (atau ke shared `MEDIA_DIR` bila host memilih static serving langsung).
- Proxy harus meneruskan cookie dan header `Authorization`, serta mengatur HTTPS di sisi hosting.

Cara install: jalankan `bash <(curl -s https://www.aapanel.com/script/install-ubuntu-7.0_en.sh)` lalu ikuti wizard. Setelah aaPanel aktif, install Plugin Website atau Webhooks dari panel. Buat script deploy di atas sebagai webhook script, lalu salin URL webhook-nya ke GitHub Secrets.

Hosting team menyediakan: Node.js ≥20 (install via aaPanel → App Store → Node.js), pnpm (`npm install -g pnpm`), MySQL 8.0 (install via aaPanel → App Store → MySQL), PM2 (`npm install -g pm2`), persistent writable upload directory, dan server environment.

For GitHub Actions, configure repository/environment values without placing them in source. The production environment should retain its required manual approval protection rule.

Frontend `VITE_API_URL` harus di-build dengan URL target yang benar (bukan localhost) — diatur langsung di script webhook aaPanel saat build.
## Alur Admin

1. Buka `/#admin` — selama tabel `users` (MySQL) kosong, form **Bootstrap Admin** muncul (sekali pakai; paritas gerbang "akun pertama" sistem lama).
2. Login → dashboard penuh: **Dashboard, Konten Situs, Berita, PMB, Galeri & Media, Pelanggan, Pengguna, Audit Log**.
3. **Konten Situs harus diisi dari dashboard** — situs publik menampilkan state "belum dikonfigurasi" sampai konten tersimpan di database. Tidak ada fallback/default content di kode (kebijakan: *tidak boleh ada data static inline / fallback / hardcode menempel di file code*).

## Migrasi Data dari Supabase

```bash
cd tools/supabase-migration
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> pnpm export
pnpm import      # idempoten ke MySQL via DATABASE_URL
pnpm reconcile   # bandingkan jumlah + checksum MySQL vs manifest
```

Service-role key **hanya** lewat environment variable — tidak pernah masuk repo, tidak pernah diekspos ke frontend.

## Deployment

- **Staging**: push ke branch `develop` → GitHub Actions POST webhook → aaPanel jalankan script deploy staging.
- **Production**: push tag `v*` → GitHub Environment `production` → approval manual → POST webhook → aaPanel jalankan script deploy production.
- Frontend memakai `VITE_API_URL` per-environment (staging/produksi berbeda), diatur di script webhook aaPanel.
- Semua deploy melalui aaPanel Webhook — tidak ada SSH dari GitHub Actions.
## Struktur Otentikasi

- JWT access token (15 menit) — di memori frontend, header `Authorization: Bearer`.
- Refresh token (30 hari) — httpOnly cookie `tpb_refresh`; di database hanya disimpan **sebagai hash** (SHA-256), rotasi saat dipakai, revocation di logout.
- Role: `ADMIN` (semua), `EDITOR` (konten & berita), `OPERATOR` (PMB & galeri).
- Bootstrap admin hanya tersedia saat tabel `users` kosong.