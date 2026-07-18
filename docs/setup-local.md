# Setup Local

Dokumen ini menjelaskan cara menjalankan project secara lokal sampai siap dipakai untuk:

- auth API
- chat user
- stream chat SSE
- role admin tanpa dashboard aktif
- runtime AI Laravel

## 1. Stack

Komponen utama:

- Laravel app di root repository
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
project-pkl-deka/
├── app/
├── bootstrap/
├── config/
├── database/
├── public/
├── resources/
├── routes/
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

Dari root repository:

```bash
cd /home/panzek/project-pkl-deka
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

## 8. Ingest Knowledge Deka

Masukkan dokumen PDF/teks:

```bash
php artisan knowledge:ingest-file "storage/app/private/docs/DEKA Knowledge Base Draft Rekap.pdf" \
    --title="DEKA Knowledge Base Draft Rekap" \
    --source="file://DEKA Knowledge Base Draft Rekap.pdf"
```

Crawl website Deka:

```bash
php artisan knowledge:crawl --base=https://deka.dev --limit=50
```

## 9. Jalankan App

```bash
php artisan serve
```

Default URL:

- `http://127.0.0.1:8000`

## 10. URL Lokal

- login: `http://127.0.0.1:8000/login`
- chat: `http://127.0.0.1:8000/chat`
- admin: `http://127.0.0.1:8000/admin` menampilkan `403` karena dashboard admin dinonaktifkan

Default admin:

- email: `admin@deka.dev`
- password: `password`

## 11. Auth dan Akses

Role yang dipakai:

- `admin`
- `user`

Aturan akses:

- `/admin` ditutup `403` karena dashboard admin sudah dihapus
- user biasa memakai `/chat`
- admin tidak memakai halaman chat user
- auth API memakai session cookie

## 12. Endpoint Penting

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

## 13. Test

Jalankan test chat utama:

```bash
php artisan test --filter='ChatApiTest|AiRuntimeClientTest'
```

Kalau PostgreSQL lokal mati, feature test chat akan gagal karena koneksi database.

## 14. Verifikasi Manual Cepat

1. buka `/login`
2. login sebagai user biasa atau admin
3. user biasa harus masuk `/chat`
4. admin diarahkan ke `/admin` dan mendapat `403`
5. pastikan command knowledge sudah selesai kalau ingin jawaban berbasis RAG
6. kirim pesan dari halaman chat
7. pastikan balasan assistant tersimpan dan muncul di sidebar conversation
