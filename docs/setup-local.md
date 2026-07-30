# Setup Local

Panduan ini menjelaskan setup lokal Chatbot Deka sampai siap dipakai untuk auth, chat user, dashboard admin, export activity log, dan knowledge retrieval.

## 1. Prasyarat

- Docker dan Docker Compose
- PHP 8.3+
- Composer
- Node.js 22+ dan npm
- API key AI provider jika ingin menguji jawaban real

## 2. Jalankan PostgreSQL + pgvector

Project memakai PostgreSQL 17 dengan pgvector dari `docker-compose.yml`.

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

## 3. Install Aplikasi

Dari root repository:

```bash
cp .env.example .env
composer install
npm install
php artisan key:generate
```

Pastikan `.env` minimal berisi koneksi database berikut:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=chatbot_deka
DB_USERNAME=chatbot_deka
DB_PASSWORD=secret
```

Untuk development tanpa email real:

```env
MAIL_MAILER=log
```

Untuk chat AI real, isi provider dan key:

```env
OPENAI_API_KEY=your-key
OPENAI_URL=https://codex.deka.dev/v1
AI_CHAT_PROVIDER=openai
AI_CHAT_MODEL=gpt-5.4-mini
```

Setelah mengubah `.env`, bersihkan cache config:

```bash
php artisan optimize:clear
```

## 4. Migrasi dan Seeder

```bash
php artisan migrate
php artisan db:seed --class=AdminUserSeeder
```

Default admin:

- email: `admin@deka.dev`
- password: `password`

## 5. Jalankan App

Untuk mode build production lokal:

```bash
npm run build
php artisan serve --host=127.0.0.1 --port=8000
```

Untuk development frontend:

```bash
php artisan serve --host=127.0.0.1 --port=8000
npm run dev
```

URL lokal:

- app: `http://127.0.0.1:8000`
- login: `http://127.0.0.1:8000/login`
- chat user: `http://127.0.0.1:8000/chat`
- admin dashboard: `http://127.0.0.1:8000/admin/overview`

## 6. Role dan Akses

- User biasa yang verified masuk ke `/chat`.
- Admin masuk ke `/admin/overview`.
- Admin tidak boleh mengakses halaman chat user.
- User biasa tidak boleh mengakses `/admin/*` dan diarahkan ke `/chat`.
- Auth API memakai session cookie dan CSRF.

## 7. Endpoint Penting

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
- `DELETE /api/conversations/{conversation}`
- `POST /api/conversations/{conversation}/messages`
- `POST /api/conversations/{conversation}/messages/stream`
- `POST /api/conversations/{conversation}/messages/{message}/feedback`

Admin:

- `GET /admin`
- `GET /admin/{section}`
- `GET /admin/activity-log/items`
- `GET /admin/activity-log/report`
- `POST /admin/activity-log/export-log`

## 8. Knowledge DEKA

Masukkan dokumen PDF/teks:

```bash
php artisan knowledge:ingest-file "storage/app/private/docs/DEKA Knowledge Base Draft Rekap.pdf" \
    --title="DEKA Knowledge Base Draft Rekap" \
    --source="file://DEKA Knowledge Base Draft Rekap.pdf" \
    --priority=100
```

Crawl website:

```bash
php artisan knowledge:crawl --base=https://deka.dev --limit=50
```

Jika hanya ingin mengecek pemahaman query tanpa provider embedding/retrieval:

```bash
php artisan chat:eval --skip-retrieval
```

## 9. Testing

Quality gate lokal:

```bash
composer test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

Browser smoke test:

```bash
php artisan serve --host=127.0.0.1 --port=8000
BASE_URL=http://127.0.0.1:8000 npm run test:e2e
```

Smoke test mengecek branding welcome, login admin, activity export, dan admin tidak bisa memakai `/chat`.

## 10. Verifikasi Manual Cepat

1. Buka `/login`.
2. Login sebagai `admin@deka.dev` / `password`.
3. Pastikan diarahkan ke `/admin/overview`.
4. Buka `/admin/activity-log` dan cek tombol export.
5. Buka `/chat` sebagai admin dan pastikan tidak masuk ke halaman chat user.
6. Login sebagai user biasa dan pastikan user diarahkan ke `/chat`.
