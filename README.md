# Chatbot Deka

Backend chatbot Deka saat ini berjalan sebagai aplikasi Laravel tunggal dengan:

- auth API berbasis session
- role `admin` dan `user`
- chat runtime via `laravel/ai`
- endpoint chat biasa dan streaming SSE
- moderation, rate limit, dan idempotency
- retrieval knowledge Deka berbasis PostgreSQL full-text search dan AI reranker

## Stack

- Laravel app di root repository
- Database: PostgreSQL via Docker Compose
- Runtime AI: `Laravel AI SDK`
- Frontend chat dasar: React/Inertia di repo yang sama

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

Chat:

- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/conversations/stream`
- `GET /api/conversations/{conversation}`
- `POST /api/conversations/{conversation}/messages`
- `POST /api/conversations/{conversation}/messages/stream`

UI:

- login: `/login`
- chat user: `/chat`
- admin: `/admin` ditutup `403` karena dashboard admin dinonaktifkan

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
```

Untuk email:

```env
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=onboarding@resend.dev
MAIL_FROM_NAME="Chatbot Deka"
RESEND_API_KEY=your-resend-api-key
```

Untuk local tanpa email real, pakai:

```env
MAIL_MAILER=log
```

## Akses Lokal

- app: `http://127.0.0.1:8000`
- login: `http://127.0.0.1:8000/login`
- chat: `http://127.0.0.1:8000/chat`
- admin: `http://127.0.0.1:8000/admin` menampilkan `403`

Default admin dari `.env.example`:

- email: `admin@deka.dev`
- password: `password`

## Catatan Frontend

Frontend tidak perlu menebak flow auth.

- auth memakai session cookie, bukan bearer token
- ambil `GET /api/auth/csrf` sebelum flow auth jika dibutuhkan
- gunakan `role` dan `redirect_to` dari response auth
- user biasa diarahkan ke `/chat` atau `/email/verify`
- admin diarahkan ke `/admin`, tetapi dashboard admin saat ini dinonaktifkan
- kontrak endpoint chat ada di [Frontend Chat API](docs/frontend-chat-api.md)

## Testing

Test chat dan runtime AI:

```bash
php artisan test --filter='ChatApiTest|AiRuntimeClientTest'
```

## Knowledge Deka

Knowledge Deka memakai tabel `knowledge_documents`, `knowledge_chunks`, dan `knowledge_ingestion_runs`. Dokumen bisa dimasukkan dari PDF/teks atau hasil crawl website, lalu chat mengambil konteks relevan sebelum meminta jawaban ke AI.

Contoh ingest:

```bash
php artisan knowledge:ingest-file "storage/app/private/docs/DEKA Knowledge Base Draft Rekap.pdf" \
    --title="DEKA Knowledge Base Draft Rekap" \
    --source="file://DEKA Knowledge Base Draft Rekap.pdf"

php artisan knowledge:crawl --base=https://deka.dev --limit=50
```
