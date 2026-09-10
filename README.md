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

# 4. Jalankan
pnpm dev:api    # http://localhost:3000/v1
pnpm dev:web    # http://localhost:5173
```

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

- **Staging**: push ke branch `develop` → GitHub Actions build + deploy + `prisma migrate deploy` + health-check.
- **Production**: tag `v*` → workflow sama dengan environment `production` (approval manual), lalu migrasi + deploy.
- Frontend memakai `VITE_API_URL` per-environment (staging/produksi berbeda).

## Struktur Otentikasi

- JWT access token (15 menit) — di memori frontend, header `Authorization: Bearer`.
- Refresh token (30 hari) — httpOnly cookie `tpb_refresh`; di database hanya disimpan **sebagai hash** (SHA-256), rotasi saat dipakai, revocation di logout.
- Role: `ADMIN` (semua), `EDITOR` (konten & berita), `OPERATOR` (PMB & galeri).
- Bootstrap admin hanya tersedia saat tabel `users` kosong.