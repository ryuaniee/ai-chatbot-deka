# Chatbot Deka

Backend chatbot Deka saat ini sudah mencakup:

- auth API berbasis session
- role `admin` dan `user`
- admin panel Filament
- chat runtime backend
- AI service internal
- fallback model
- kontrak redirect auth untuk admin dan user

Status produk saat ini:

- fondasi backend sudah siap
- frontend custom belum dikerjakan di repo ini
- starter frontend bawaan bukan fokus implementasi
- knowledge khusus `deka.dev` belum di-ingest

## Stack

### Laravel App

Lokasi:

- `app/`

Fungsi:

- auth API
- role `admin` dan `user`
- admin panel Filament
- workflow chat
- persistence conversation dan message

### AI Service

Lokasi:

- `ai-service/`

Fungsi:

- moderation
- generate assistant response
- generate conversation title
- fallback model

### Database

Yang dipakai:

- PostgreSQL via Docker Compose

## Dokumentasi

Dokumen utama:

- [Setup Local](docs/setup-local.md)
- [Ringkasan Progres Backend](docs/backend-progress-summary.md)
- [Arsitektur Backend Final](docs/deka-chatbot-backend-architecture.md)

## Status Backend

Yang sudah ada:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/{conversation}`
- `POST /api/conversations/{conversation}/messages`
- `GET /admin/login`
- panel admin Filament di `/admin`

Role yang dipakai hanya dua:

- `admin`
- `user`

Aturan akses:

- user baru otomatis mendapat role `user`
- hanya `role=admin` yang bisa masuk panel admin
- user biasa memakai auth API dan flow chat biasa
- response auth menyertakan `redirect_to`

## Quick Start

### 1. Nyalakan Database

```bash
docker compose up -d
```

### 2. Jalankan Laravel App

```bash
cd app
cp .env.example .env
composer install
npm install
php artisan key:generate
php artisan migrate
php artisan db:seed --class=AdminUserSeeder
php artisan serve
```

### 3. Jalankan AI Service

```bash
cd ai-service
cp .env.example .env
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### 4. Verifikasi

Health check AI service:

```bash
curl http://127.0.0.1:8001/health
```

Admin panel:

- `http://127.0.0.1:8000/admin/login`

Default admin dari `.env.example`:

- email: `admin@deka.dev`
- password: `password`

## Catatan untuk Frontend Agent

Frontend tidak perlu menebak flow auth.

Gunakan kontrak berikut:

- auth memakai session cookie, bukan bearer token
- ambil `GET /api/auth/csrf` sebelum flow auth jika dibutuhkan client flow
- login/register memakai endpoint auth API yang sudah tersedia
- gunakan field `role` dari response auth untuk memisahkan `admin` dan `user`
- gunakan field `redirect_to` dari response auth sebagai target redirect final
- user biasa diarahkan ke flow chat
- admin diarahkan ke `/admin` jika memang memakai panel backend

## Tahap Berikutnya

Yang belum dikerjakan:

- crawl `deka.dev`
- ingestion dokumen
- vector store / `pgvector`
- retrieval
- inject context knowledge Deka ke AI service
- pembatasan jawaban hanya ke knowledge Deka

Secara singkat:

> auth, admin, dan runtime chat sudah siap; knowledge chatbot Deka adalah fase berikutnya.
