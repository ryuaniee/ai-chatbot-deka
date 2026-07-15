# Setup Local

Dokumen ini menjelaskan cara menjalankan project secara lokal sampai siap dipakai untuk:

- auth API
- chat user
- stream chat SSE
- admin panel Filament
- runtime AI Laravel

## 1. Stack

Komponen utama:

- Laravel app di `app/`
- PostgreSQL via Docker Compose
- runtime AI langsung di Laravel via `laravel/ai`

Tidak ada lagi service Python terpisah untuk runtime chat.

## 2. Prasyarat

Pastikan mesin lokal punya:

- Docker dan Docker Compose
- PHP `8.3+`
- Composer
- Node.js dan npm

## 3. Struktur Folder

```text
chatbot-deka/
├── app/
├── docker-compose.yml
└── docs/
```

## 4. Nyalakan PostgreSQL

Dari root project:

```bash
docker compose up -d
docker compose ps
```

Default koneksi lokal:

- host: `127.0.0.1`
- port: `5433`
- database: `chatbot_deka`
- username: `chatbot_deka`
- password: `secret`

## 5. Setup Laravel

Masuk ke folder app:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/app
```

Install dependency:

```bash
composer install
npm install
```

Siapkan environment:

```bash
cp .env.example .env
php artisan key:generate
```

## 6. Konfigurasi `.env`

Minimal pastikan nilai berikut benar:

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
AI_CHAT_FALLBACK_PROVIDER=
AI_CHAT_FALLBACK_MODEL=
AI_CHAT_TIMEOUT=30
AI_CHAT_RATE_LIMIT_PER_MINUTE=20
AI_CHAT_MAX_HISTORY_MESSAGES=6
AI_CHAT_MAX_HISTORY_CHARACTERS=6000
AI_CHAT_IDEMPOTENCY_TTL_MINUTES=10
MODERATION_MODEL=omni-moderation-latest

ADMIN_NAME="Admin Deka"
ADMIN_EMAIL=admin@deka.dev
ADMIN_PASSWORD=password
```

Untuk email:

```env
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=onboarding@resend.dev
MAIL_FROM_NAME="Chatbot Deka"
RESEND_API_KEY=your-resend-api-key
```

Untuk development tanpa email real:

```env
MAIL_MAILER=log
```

Setelah ubah `.env`, aman jalankan:

```bash
php artisan optimize:clear
```

## 7. Migration dan Seeder

```bash
php artisan migrate
php artisan db:seed --class=AdminUserSeeder
```

## 8. Jalankan App

```bash
php artisan serve
```

Default URL:

- `http://127.0.0.1:8000`

## 9. URL Lokal

- login: `http://127.0.0.1:8000/login`
- chat: `http://127.0.0.1:8000/chat`
- admin: `http://127.0.0.1:8000/admin`

Default admin:

- email: `admin@deka.dev`
- password: `password`

## 10. Auth dan Akses

Role yang dipakai:

- `admin`
- `user`

Aturan akses:

- hanya `admin` boleh ke `/admin`
- user biasa memakai `/chat`
- admin tidak memakai halaman chat user
- auth API memakai session cookie

## 11. Endpoint Penting

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

## 12. Test

Jalankan test chat utama:

```bash
php artisan test --filter='ChatApiTest|AiRuntimeClientTest'
```

Kalau PostgreSQL lokal mati, feature test chat akan gagal karena koneksi database.

## 13. Verifikasi Manual Cepat

1. buka `/login`
2. login sebagai user biasa atau admin
3. user biasa harus masuk `/chat`
4. admin harus masuk `/admin`
5. kirim pesan di halaman chat untuk memverifikasi non-stream dan stream flow frontend
