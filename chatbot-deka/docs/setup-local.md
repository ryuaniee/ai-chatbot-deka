# Setup Local

Dokumen ini menjelaskan cara menjalankan project secara lokal dari nol sampai siap dipakai untuk:

- auth API
- chatbot backend
- AI service
- admin panel Filament

Catatan:

- repo ini difokuskan ke backend
- halaman auth dan chat dasar sudah tersedia di repo ini
- frontend tetap diharapkan memakai kontrak API backend yang sudah disiapkan

## 1. Gambaran Stack

Project ini terdiri dari dua service utama:

### Laravel App

Lokasi:

- `app/`

Fungsi:

- auth API
- role `admin` dan `user`
- admin panel Filament
- workflow chat
- penyimpanan conversation dan message

### AI Service

Lokasi:

- `ai-service/`

Fungsi:

- moderation
- generate reply
- generate conversation title
- fallback model

### Database

Yang dipakai:

- PostgreSQL via Docker Compose

Port default:

- `5433`

## 2. Prasyarat

Pastikan local machine sudah punya:

- Docker dan Docker Compose
- PHP `8.3+`
- Composer
- Node.js
- Python `3.12+`
- `uv`

## 3. Struktur Folder Penting

```text
chatbot-deka/
├── app/
├── ai-service/
├── docker-compose.yml
└── docs/
```

## 4. Menyalakan Database

Dari root project:

```bash
docker compose up -d
```

Cek container:

```bash
docker compose ps
```

PostgreSQL lokal default:

- host: `127.0.0.1`
- port: `5433`
- database: `chatbot_deka`
- username: `chatbot_deka`
- password: `secret`

## 5. Setup Laravel App

Masuk ke folder app:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/app
```

### 5.1 Siapkan Environment

Kalau `.env` belum ada:

```bash
cp .env.example .env
```

Generate app key:

```bash
php artisan key:generate
```

### 5.2 Konfigurasi Penting Laravel

Nilai default penting di `.env`:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=chatbot_deka
DB_USERNAME=chatbot_deka
DB_PASSWORD=secret

AI_SERVICE_URL=http://127.0.0.1:8001
AI_SERVICE_INTERNAL_TOKEN=GouTOiReW0p09X3lpElLERTBdUxGYF9xmcJ5td-Q5Pk

ADMIN_NAME="Admin Deka"
ADMIN_EMAIL=admin@deka.dev
ADMIN_PASSWORD=password

MAIL_MAILER=resend
MAIL_FROM_ADDRESS=onboarding@resend.dev
MAIL_FROM_NAME="Chatbot Deka"
RESEND_API_KEY=your-resend-api-key
```

### 5.3 Jalankan Migration

```bash
php artisan migrate
```

### 5.4 Seed Admin

```bash
php artisan db:seed --class=AdminUserSeeder
```

### 5.5 Jalankan Laravel

```bash
php artisan serve
```

Default URL:

- `http://127.0.0.1:8000`

## 6. Setup AI Service

Masuk ke folder AI service:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/ai-service
```

### 6.1 Siapkan Environment

Kalau `.env` belum ada:

```bash
cp .env.example .env
```

### 6.2 Konfigurasi Penting AI Service

Isi `.env` minimal:

```env
APP_ENV=local

OPENAI_API_KEY=your-key
OPENAI_BASE_URL=http://localhost:20127/v1
LANGCHAIN_MODEL=AC/DeepSeek-V4-Pro
LANGCHAIN_FALLBACK_MODELS=AC/auto,AC/DeepSeek-V4-Flash
OPENAI_TIMEOUT_SECONDS=30

AI_SERVICE_INTERNAL_TOKEN=GouTOiReW0p09X3lpElLERTBdUxGYF9xmcJ5td-Q5Pk

MODERATION_MODEL=omni-moderation-latest
MODERATION_MODE=local_only
```

Catatan:

- `AI_SERVICE_INTERNAL_TOKEN` di Laravel dan AI service harus sama
- `OPENAI_BASE_URL` harus mengarah ke router model lokal Anda

### 6.3 Jalankan AI Service

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Default URL:

- `http://127.0.0.1:8001`

### 6.4 Health Check

```bash
curl http://127.0.0.1:8001/health
```

Expected:

```json
{"status":"ok","service":"ai-service","environment":"local"}
```

## 7. Setup Filament Admin Panel

Admin panel sudah terpasang di Laravel app.

URL admin:

- `http://127.0.0.1:8000/admin`

URL login semua role:

- `http://127.0.0.1:8000/login`

URL chat user biasa:

- `http://127.0.0.1:8000/chat`

Default admin dari `.env`:

- email: `admin@deka.dev`
- password: `password`

Catatan:

- hanya user dengan `role=admin` yang bisa masuk panel
- user biasa tidak bisa akses `/admin`
- admin tidak memakai halaman login Filament terpisah
- admin juga tidak boleh memakai halaman `/chat`

## 8. Setup Email Verification dengan Resend

Laravel app sudah siap memakai transport `resend`.

Isi `app/.env` minimal:

```env
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=onboarding@resend.dev
MAIL_FROM_NAME="Chatbot Deka"
RESEND_API_KEY=your-resend-api-key
```

Catatan:

- `onboarding@resend.dev` cukup untuk testing awal
- untuk production, ganti ke alamat dari domain Anda yang sudah diverifikasi di Resend
- setelah ubah `.env`, jalankan `php artisan optimize:clear`
- untuk development tanpa kirim email real, set `MAIL_MAILER=log`

## 9. Auth API Lokal

Endpoint auth yang tersedia:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Field penting pada response auth:

- `role`
- `redirect_to`

### 9.1 Ambil CSRF Token

```bash
curl -c cookies.txt http://127.0.0.1:8000/api/auth/csrf
```

### 9.2 Register

```bash
curl -i -c cookies.txt -b cookies.txt \
  -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tester API",
    "email": "tester@example.com",
    "password": "password",
    "password_confirmation": "password"
  }'
```

### 9.3 Login

```bash
curl -i -c cookies.txt -b cookies.txt \
  -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tester@example.com",
    "password": "password"
  }'
```

### 9.4 Cek User Aktif

```bash
curl -i -b cookies.txt \
  -H "Accept: application/json" \
  http://127.0.0.1:8000/api/auth/me
```

Perilaku response auth:

- user biasa mendapat `redirect_to=/chat`
- admin mendapat `redirect_to=/admin`

Catatan:

- user yang belum verify email akan diarahkan ke `/email/verify`
- user yang sudah verify tidak boleh tetap tinggal di halaman `/email/verify`
- resend verification email dibatasi `3x / 10 menit`
- forgot password dibatasi `3x / 10 menit`

## 10. Tes AI Service Tanpa Frontend

Tes langsung ke AI service:

```bash
curl -i -X POST http://127.0.0.1:8001/chat/respond \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: GouTOiReW0p09X3lpElLERTBdUxGYF9xmcJ5td-Q5Pk" \
  -d '{
    "conversation_id": 1,
    "user_id": 22,
    "messages": [
      { "role": "user", "content": "Halo, kamu siapa?" }
    ]
  }'
```

## 11. Dokumen Frontend Chat

Untuk agent frontend, gunakan dokumen ini:

- [Frontend Chat API](frontend-chat-api.md)

Jika sukses, Anda akan mendapat:

- status `200 OK`
- message assistant
- usage metadata
- nama model aktif

## 10. Tes Chat Backend Tanpa Frontend

### 10.1 Lewat Tinker

Masuk ke Laravel app:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/app
php artisan tinker
```

Lalu:

```php
$user = \App\Models\User::first();
$service = app(\App\Services\ConversationChatService::class);

[$conversation, $userMessage, $assistantMessage] = $service->startConversation(
    $user,
    'Halo, bantu saya ringkas informasi Deka'
);

$assistantMessage->content;
```

Lanjut kirim pesan kedua:

```php
[$userMessage2, $assistantMessage2] = $service->sendMessage(
    $conversation,
    $user,
    'Sekarang buat versi poin-poinnya'
);

$assistantMessage2->content;
```

### 10.2 Lewat API Chat

Setelah login dan punya cookie session:

```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://127.0.0.1:8000/api/conversations \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: convo-001" \
  -d '{
    "content": "Halo, bantu saya ringkas informasi Deka"
  }'
```

## 11. Menjalankan Test

### Laravel

Masuk ke folder app:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/app
```

Test auth API:

```bash
php artisan test tests/Feature/AuthApiTest.php
```

Test role helper:

```bash
php artisan test tests/Unit/UserRoleTest.php
```

Test chat:

```bash
php artisan test tests/Feature/ChatApiTest.php
```

Test unit ringan:

```bash
php artisan test tests/Unit/AiServiceClientTest.php
```

Catatan:

- jika PostgreSQL lokal belum hidup, feature test yang memakai database akan gagal

### AI Service

Masuk ke folder AI service:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/ai-service
```

Jalankan test:

```bash
./.venv/bin/pytest tests/test_main.py tests/test_llm.py
```

## 12. Troubleshooting

### `Could not open input file: artisan`

Penyebab:

- Anda menjalankan command Laravel dari folder yang salah

Solusi:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/app
php artisan serve
```

### `ModuleNotFoundError: No module named 'app'`

Penyebab:

- Anda menjalankan `uvicorn` dari folder yang salah

Solusi:

```bash
cd /home/panzek/project-pkl-deka/chatbot-deka/ai-service
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### `CSRF token mismatch`

Penyebab umum:

- belum ambil cookie session
- belum sync CSRF flow
- shell command salah

Solusi paling sederhana:

- gunakan auth API JSON + cookie session
- gunakan field `redirect_to` untuk menentukan redirect akhir
- atau tes chat lewat `tinker`

### `MODEL_UNAVAILABLE`

Penyebab umum:

- router model tidak hidup
- model utama unavailable
- semua fallback model unavailable

Cek:

```bash
curl http://localhost:20127/v1/models
```

### Test gagal koneksi PostgreSQL

Penyebab:

- container database belum hidup

Solusi:

```bash
docker compose up -d
```

## 13. Urutan Menjalankan Semua Service

Urutan paling aman:

1. nyalakan PostgreSQL
2. jalankan migration Laravel
3. seed admin
4. jalankan Laravel app
5. jalankan AI service
6. cek health AI service
7. login admin atau login user
8. tes chat

## 14. Status Saat Ini

Yang sudah siap dipakai lokal:

- auth API
- role `admin` dan `user`
- admin panel Filament
- chat runtime backend
- AI service internal
- fallback model
- redirect auth berbasis role

Yang belum masuk tahap final:

- knowledge ingestion `deka.dev`
- retrieval
- vector store
- pembatasan jawaban hanya ke knowledge Deka
