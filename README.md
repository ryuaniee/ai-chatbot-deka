# Chatbot Deka

Aplikasi Laravel tunggal untuk chatbot informasi **DEKA** (perusahaan IT / solusi AI & transformasi digital).

Fitur utama:

- auth session (cookie), role `admin` dan `user`
- chat runtime via `laravel/ai` (non-stream + SSE streaming)
- moderation, rate limit, dan idempotency
- retrieval knowledge DEKA (PostgreSQL full-text + AI reranker)
- dashboard admin: overview, token usage, feedback review, users, roles, activity log + export

## Stack

- Laravel + Inertia React (frontend di repo yang sama)
- Database: PostgreSQL via Docker Compose
- Runtime AI: Laravel AI SDK

## Dokumentasi

- [Setup Local](docs/setup-local.md)
- [Frontend Chat API](docs/frontend-chat-api.md)
- [Arsitektur Backend](docs/deka-chatbot-backend-architecture.md)
- [Ringkasan Progres Backend](docs/backend-progress-summary.md)

## Endpoint Utama

Auth:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Chat (role `user`, verified):

- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/conversations/stream`
- `GET /api/conversations/{conversation}`
- `DELETE /api/conversations/{conversation}`
- `POST /api/conversations/{conversation}/messages`
- `POST /api/conversations/{conversation}/messages/stream`
- `POST /api/conversations/{conversation}/messages/{message}/feedback`

Admin (role `admin`, verified):

- `GET /admin` → redirect ke `/admin/overview`
- `GET /admin/{section}` section: `overview`, `token-usage`, `feedback-review`, `users`, `roles`, `activity-log`
- `GET /admin/activity-log/items`
- `GET /admin/activity-log/report` (export PDF / print)
- `POST /admin/activity-log/export-log` (catat export Excel/PDF ke activity log)
- CRUD Inertia form: `/admin/users`, `/admin/roles`
- feedback review: status / solve / ignore

UI:

- welcome: `/`
- login: `/login`
- register: `/register`
- chat user: `/chat` (hanya role `user`)
- admin dashboard: `/admin/overview` (hanya role `admin`)

Catatan akses:

- admin **tidak** bisa mengakses `/chat` (403 `ADMIN_ACCESS_DENIED`)
- user biasa **tidak** bisa mengakses `/admin/*` (redirect ke `/chat`)

## Quick Start

### 1. Nyalakan database

```bash
docker compose up -d
```

### 2. Setup app Laravel

```bash
cp .env.example .env
composer install
npm install
php artisan key:generate
php artisan migrate
php artisan db:seed --class=AdminUserSeeder
npm run build
php artisan serve
```

### 3. Konfigurasi `.env`

Minimal sesuaikan:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=chatbot_deka
DB_USERNAME=chatbot_deka
DB_PASSWORD=secret

OPENAI_API_KEY=your-key
OPENAI_URL=https://codex.deka.dev/v1

AI_CHAT_PROVIDER=openai
AI_CHAT_MODEL=gpt-5.4-mini
AI_CHAT_MODERATION_ENABLED=true
AI_CHAT_MODERATION_FAIL_CLOSED=true
AI_CHAT_OUTPUT_MODERATION_ENABLED=true
AI_CHAT_STREAM_SAFETY_MODE=buffered
```

Untuk email production/staging:

```env
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=onboarding@resend.dev
MAIL_FROM_NAME="Chatbot Deka"
RESEND_API_KEY=your-resend-api-key
```

Untuk local tanpa email real:

```env
MAIL_MAILER=log
```

## Akses Lokal

- app: `http://127.0.0.1:8000`
- login: `http://127.0.0.1:8000/login`
- chat user: `http://127.0.0.1:8000/chat`
- admin: `http://127.0.0.1:8000/admin/overview`

## Akses melalui ngrok

Untuk membagikan aplikasi tanpa hot reload, gunakan hasil build agar CSS/JS
dilayani Laravel dari tunnel yang sama:

```bash
npm run build
rm -f public/hot
php artisan serve --host=0.0.0.0 --port=8000
ngrok http 8000
```

Set `APP_URL` di `.env` ke URL HTTPS ngrok, lalu jalankan
`php artisan config:clear`. Jangan jalankan `npm run dev` pada mode ini karena
file `public/hot` akan membuat browser publik mencoba mengambil aset dari Vite.

Untuk hot reload, Laravel dan Vite memerlukan tunnel masing-masing. Arahkan
tunnel aplikasi ke port `8000` dan tunnel Vite ke port `5173`, lalu isi `.env`:

```env
APP_URL=https://url-aplikasi.ngrok-free.app
VITE_DEV_SERVER_URL=https://url-vite.ngrok-free.app
```

Setelah kedua URL terisi, restart server dengan:

```bash
php artisan config:clear
php artisan serve --host=0.0.0.0 --port=8000
npm run dev
```

Default admin dari seeder / `.env.example`:

- email: `admin@deka.dev`
- password: `password`

## Catatan Frontend & CSRF

- auth memakai **session cookie**, bukan bearer token
- ambil `GET /api/auth/csrf` sebelum flow auth/API jika cookie XSRF belum ada
- gunakan `role` dan `redirect_to` dari response auth
- user biasa → `/chat` (atau `/email/verify` jika belum verified)
- admin → `/admin`
- kontrak chat: [Frontend Chat API](docs/frontend-chat-api.md)

### Admin users/roles (bukan JSON API murni)

Create/update/delete user & role memakai **Inertia form POST/PUT/DELETE** (session + CSRF cookie/`X-XSRF-TOKEN`), lalu `back()` + flash toast.

Jangan memanggil endpoint admin CRUD sebagai pure JSON API tanpa session Inertia; request tanpa CSRF valid akan gagal (419 / redirect). UI admin sudah mengirim form lewat `useForm` Inertia.

Field penting create user:

- `name`, `email`, `role`, `password`, `password_confirmation`
- `email_verified` (boolean) — wajib

## Testing

Feature/unit:

```bash
php artisan test --filter='ChatApiTest|AiRuntimeClientTest|AdminDashboardBackendTest'
```

Browser smoke (butuh app running di `http://127.0.0.1:8000`):

```bash
npm run test:e2e
```

## Knowledge DEKA

Knowledge memakai dokumen berversi, chunks, dan ingestion runs. Dokumen diingest dari PDF/teks atau crawl website, lalu chat hanya mengambil versi aktif yang sudah lulus validasi.

Konfigurasi standar memakai retrieval hybrid: PostgreSQL full-text menjaga exact match dan embedding Gemini menangani parafrasa semantik. Jika embedding sedang gagal, hybrid tetap dapat memakai full-text, tetapi versi baru tidak menggantikan versi aktif sebelum seluruh probe retrieval dan jawaban Gemini lulus.

Akurasi jawaban tetap bergantung pada kelengkapan data aktif. Sebelum mengaktifkan knowledge di production, pastikan dokumen resmi sudah diingest, versi aktif punya chunk yang cukup, dan validasi/probe knowledge lulus. Dashboard admin menampilkan readiness knowledge secara konservatif agar sistem tidak terlihat siap ketika sumber datanya masih kurang.

Fakta bisnis seperti alamat, kontak, nama tim, dan jam operasional harus berada di knowledge, bukan di prompt atau source code. File kurasi memiliki prioritas default `100`, sedangkan halaman website `50`; gunakan `--priority` untuk override dokumen tertentu.

Contoh ingest:

```bash
php artisan knowledge:ingest-file "storage/app/private/docs/DEKA Knowledge Base Draft Rekap.pdf" \
    --title="DEKA Knowledge Base Draft Rekap" \
    --source="file://DEKA Knowledge Base Draft Rekap.pdf" \
    --priority=100

php artisan knowledge:crawl --base=https://deka.dev --limit=50
```

Setiap chunk yang berubah menghasilkan tiga probe (literal, parafrasa, dan bahasa percakapan). Output command menampilkan status versi dan hasil probe. Exit code gagal berarti versi kandidat disimpan sebagai `failed`; versi aktif sebelumnya tetap digunakan chatbot.

Aktifkan crawl harian melalui `DEKA_KNOWLEDGE_SCHEDULED_CRAWL_ENABLED=true` dan pastikan Laravel scheduler berjalan. Kualitas pemahaman typo dan konteks dapat diperiksa tanpa memanggil provider:

```bash
php artisan chat:eval --skip-retrieval
```

Jalankan tanpa `--skip-retrieval` setelah knowledge terisi untuk ikut mengukur retrieval cases yang ditandai pada dataset.
