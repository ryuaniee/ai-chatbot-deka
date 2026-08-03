# Chatbot Deka

[![tests](https://github.com/darksoul729/chatbot-deka/actions/workflows/tests.yml/badge.svg)](https://github.com/darksoul729/chatbot-deka/actions/workflows/tests.yml)
[![linter](https://github.com/darksoul729/chatbot-deka/actions/workflows/lint.yml/badge.svg)](https://github.com/darksoul729/chatbot-deka/actions/workflows/lint.yml)

Aplikasi Laravel + Inertia React untuk chatbot informasi DEKA, dengan auth session, chat AI, retrieval knowledge, dan dashboard admin.

## Fitur Utama

- Auth session cookie untuk role `user` dan `admin`.
- Chat user dengan non-stream request dan SSE streaming.
- Safety layer: moderation, output guard, rate limit, dan idempotency.
- Knowledge DEKA berbasis PostgreSQL, full-text search, embedding, dan validasi versi knowledge.
- Dashboard admin: overview, token usage, feedback review, users, roles, activity log, export PDF, dan export Excel.
- Browser smoke test untuk login admin, dashboard activity log, export, dan admin blocking dari chat.

## Stack

- Laravel 13, PHP `^8.3`
- Inertia React, Vite, Tailwind CSS
- PostgreSQL 17 + pgvector via Docker Compose
- Laravel AI SDK
- GitHub Actions untuk lint, static analysis, PHPUnit, build, dan browser smoke test

## Dokumentasi

- [Setup Local](docs/setup-local.md)
- [Frontend Chat API](docs/frontend-chat-api.md)
- [Arsitektur Backend](docs/deka-chatbot-backend-architecture.md)
- [Workflow Backend-Frontend](docs/workflow-backend-frontend.md)
- [Production Security Checklist](docs/production-security-checklist.md)

## Quick Start

Prasyarat:

- Docker dan Docker Compose
- PHP 8.3+
- Composer
- Node.js 22+ dan npm

Jalankan PostgreSQL:

```bash
docker compose up -d
```

Install dan setup aplikasi:

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

URL lokal:

- app: `http://127.0.0.1:8000`
- login: `http://127.0.0.1:8000/login`
- chat user: `http://127.0.0.1:8000/chat`
- admin dashboard: `http://127.0.0.1:8000/admin/overview`

Default admin dari seeder:

- email: `admin@deka.dev`
- password: `password`

## Environment

Database lokal mengikuti `docker-compose.yml`:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=chatbot_deka
DB_USERNAME=chatbot_deka
DB_PASSWORD=secret
```

AI provider minimal:

```env
OPENAI_API_KEY=your-key
OPENAI_URL=https://codex.deka.dev/v1
AI_CHAT_PROVIDER=openai
AI_CHAT_MODEL=gpt-5.4-mini
```

Untuk local development tanpa email real:

```env
MAIL_MAILER=log
```

Untuk production/staging dengan Resend:

```env
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=onboarding@resend.dev
MAIL_FROM_NAME="Chatbot Deka"
RESEND_API_KEY=your-resend-api-key
```

Setelah mengubah `.env`, jalankan:

```bash
php artisan optimize:clear
```

## Akses dan Endpoint

Aturan akses:

- `user` verified mengakses `/chat`.
- `admin` verified mengakses `/admin/overview`.
- Admin tidak boleh memakai halaman chat user.
- User biasa diarahkan dari area admin ke `/chat`.
- Auth API memakai session cookie dan CSRF, bukan bearer token.

Endpoint utama:

- Auth: `GET /api/auth/csrf`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- Chat: `GET /api/conversations`, `POST /api/conversations`, `POST /api/conversations/stream`, `GET /api/conversations/{conversation}`, `POST /api/conversations/{conversation}/messages`, `POST /api/conversations/{conversation}/messages/stream`
- Admin UI: `GET /admin`, `GET /admin/{section}`
- Admin activity: `GET /admin/activity-log/items`, `GET /admin/activity-log/report`, `POST /admin/activity-log/export-log`

Admin users/roles memakai Inertia form POST/PUT/DELETE dengan session dan CSRF. Jangan panggil endpoint CRUD admin sebagai JSON API murni tanpa session Inertia.

## Testing

Jalankan quality gate lokal:

```bash
composer test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

Browser smoke test membutuhkan aplikasi berjalan dan admin sudah diseed:

```bash
php artisan serve --host=127.0.0.1 --port=8000
BASE_URL=http://127.0.0.1:8000 npm run test:e2e
```

GitHub Actions menjalankan:

- `linter`: Pint, Prettier, ESLint
- `tests`: build frontend, PHPStan, PHPUnit matrix PHP 8.3/8.4/8.5, dan browser smoke test

## Knowledge DEKA

Knowledge memakai dokumen berversi, chunks, ingestion runs, dan validation probes. Dokumen dapat berasal dari file PDF/teks atau crawl website. Chat hanya memakai versi aktif yang sudah lulus validasi.

Contoh ingest file:

```bash
php artisan knowledge:ingest-file "storage/app/private/docs/DEKA Knowledge Base Draft Rekap.pdf" \
    --title="DEKA Knowledge Base Draft Rekap" \
    --source="file://DEKA Knowledge Base Draft Rekap.pdf" \
    --priority=100
```

Contoh crawl:

```bash
php artisan knowledge:crawl --base=https://deka.dev --limit=50
```

Aktifkan crawl harian dengan `DEKA_KNOWLEDGE_SCHEDULED_CRAWL_ENABLED=true` dan pastikan Laravel scheduler berjalan.

## Ngrok

Untuk share aplikasi tanpa hot reload:

```bash
npm run build
rm -f public/hot
php artisan serve --host=0.0.0.0 --port=8000
ngrok http 8000
```

Set `APP_URL` ke URL HTTPS ngrok, lalu jalankan `php artisan config:clear`.

Untuk hot reload, Laravel dan Vite butuh tunnel terpisah. Isi:

```env
APP_URL=https://url-aplikasi.ngrok-free.app
VITE_DEV_SERVER_URL=https://url-vite.ngrok-free.app
```

Lalu restart:

```bash
php artisan config:clear
php artisan serve --host=0.0.0.0 --port=8000
npm run dev
```
