# Ringkasan Pekerjaan Backend

Dokumen ini merangkum pekerjaan backend yang sudah dikerjakan dari awal sampai kondisi sistem saat ini.

## 1. Tujuan yang Sudah Dicapai

Fokus kerja yang sudah selesai:

- membangun backend chatbot single assistant
- menyiapkan auth API untuk login, register, logout, dan session user
- menyiapkan fondasi role `admin` dan `user`
- menyiapkan admin panel dengan Filament
- menyimpan conversation dan message ke database
- menghubungkan Laravel ke AI service internal
- menambahkan moderation, rate limit, dan idempotency
- menyiapkan AI service dengan endpoint chat internal
- menambahkan fallback model agar tidak tergantung satu model upstream
- memvalidasi alur chat end-to-end tanpa frontend

Kesimpulan status saat ini:

- auth backend sudah jalan
- role dasar sudah jalan
- panel admin sudah jalan
- backend chat runtime sudah jalan
- AI service sudah jalan
- koneksi ke router model sudah jalan
- fallback model sudah jalan
- redirect auth admin dan user sudah konsisten
- email verification, reset password, dan welcome email sudah jalan
- frontend chat dasar sudah ada dan sudah terhubung ke API backend
- chatbot saat ini masih chatbot umum
- knowledge khusus Deka belum di-ingest

## 2. Arsitektur yang Sudah Dibangun

### Laravel App

Sudah berfungsi sebagai:

- auth API berbasis session JSON
- pengelola role `admin` dan `user`
- orchestrator workflow chat
- penyimpan conversation dan message
- pemanggil moderation
- pemanggil AI service
- pengelola auth, rate limit, dan idempotency

### AI Service

Sudah berfungsi sebagai:

- internal chat gateway
- pemanggil model OpenAI-compatible
- generator response assistant
- generator title conversation
- moderation service
- fallback model handler

### Model Router

Sudah terbukti:

- bisa diakses dari `ai-service`
- bisa mengembalikan model response
- sudah lolos pengujian dengan model aktif

## 3. Pekerjaan yang Sudah Selesai di Laravel

### 3.1 Database Chat

Sudah dibuat:

- role pada tabel users
- tabel conversations
- tabel messages
- relasi user ke conversations
- relasi conversation ke messages
- relasi assistant reply ke user message lewat `reply_to_message_id`

File utama:

- [app/database/migrations/2026_07_13_200000_add_role_to_users_table.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/migrations/2026_07_13_200000_add_role_to_users_table.php:1)
- [app/database/migrations/2026_07_13_000000_create_conversations_and_messages_tables.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/migrations/2026_07_13_000000_create_conversations_and_messages_tables.php:1)
- [app/database/migrations/2026_07_13_120000_add_reply_to_message_id_to_messages_table.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/migrations/2026_07_13_120000_add_reply_to_message_id_to_messages_table.php:1)
- [app/app/Models/Conversation.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Models/Conversation.php:1)
- [app/app/Models/Message.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Models/Message.php:1)
- [app/app/Models/User.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Models/User.php:1)

### 3.2 Auth API dan Role Dasar

Sudah dibuat endpoint untuk:

- ambil CSRF token
- register
- login
- logout
- ambil user aktif

Kontrak response auth:

- field `role`
- field `redirect_to`

Role yang disiapkan:

- `admin`
- `user`

Aturan saat ini:

- user baru otomatis mendapat role `user`
- hanya `role=admin` yang boleh masuk panel admin
- user biasa tetap memakai auth biasa dan API chat
- admin diarahkan ke `/admin`
- user biasa diarahkan ke `/chat`

File utama:

- [app/app/Http/Controllers/AuthApiController.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Http/Controllers/AuthApiController.php:1)
- [app/app/Actions/Fortify/CreateNewUser.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Actions/Fortify/CreateNewUser.php:1)
- [app/app/Models/User.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Models/User.php:1)
- [app/database/factories/UserFactory.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/factories/UserFactory.php:1)
- [app/routes/web.php](/home/panzek/project-pkl-deka/chatbot-deka/app/routes/web.php:1)

### 3.3 API dan Controller Chat

Sudah dibuat endpoint untuk:

- list conversations
- create conversation
- show conversation
- send message ke conversation

File utama:

- [app/app/Http/Controllers/ConversationController.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Http/Controllers/ConversationController.php:1)
- [app/app/Http/Controllers/ConversationMessageController.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Http/Controllers/ConversationMessageController.php:1)
- [app/routes/web.php](/home/panzek/project-pkl-deka/chatbot-deka/app/routes/web.php:1)

### 3.4 Service Layer Chat

Sudah dibuat service utama untuk alur chat:

- mulai conversation baru
- kirim pesan lanjutan
- simpan user message
- panggil moderation
- panggil AI service
- simpan assistant reply
- generate title conversation

File utama:

- [app/app/Services/ConversationChatService.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Services/ConversationChatService.php:1)
- [app/app/Services/AiServiceClient.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Services/AiServiceClient.php:1)
- [app/app/Services/MessageModerationService.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Services/MessageModerationService.php:1)

### 3.5 Middleware dan Guardrail

Sudah dibuat:

- request id assignment
- idempotency handling
- throttle chat
- resend verification email throttle
- forgot password throttle
- controlled error mapping untuk AI service

File utama:

- [app/app/Http/Middleware/AssignRequestId.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Http/Middleware/AssignRequestId.php:1)
- [app/app/Http/Middleware/HandleIdempotency.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Http/Middleware/HandleIdempotency.php:1)
- [app/app/Providers/AppServiceProvider.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Providers/AppServiceProvider.php:1)
- [app/app/Exceptions](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Exceptions)

### 3.6 Konfigurasi Integrasi AI

Sudah ditambahkan konfigurasi:

- AI service URL
- timeout
- internal token
- rate limit
- batas history
- TTL idempotency

File utama:

- [app/config/services.php](/home/panzek/project-pkl-deka/chatbot-deka/app/config/services.php:1)
- [app/.env.example](/home/panzek/project-pkl-deka/chatbot-deka/app/.env.example:1)

## 4. Pekerjaan yang Sudah Selesai di AI Service

### 4.1 Endpoint Internal

Sudah dibuat endpoint:

- `GET /health`
- `POST /chat/respond`
- `POST /chat/title`
- `POST /chat/moderate`

File utama:

- [ai-service/app/main.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/app/main.py:1)
- [ai-service/app/schemas.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/app/schemas.py:1)

### 4.2 Integrasi LLM

Sudah dibuat:

- service pemanggil model lewat `ChatOpenAI`
- system prompt dasar
- title prompt
- normalisasi response content
- dukungan response usage metadata yang nested

File utama:

- [ai-service/app/llm.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/app/llm.py:1)
- [ai-service/app/prompts.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/app/prompts.py:1)

### 4.3 Moderation

Sudah dibuat:

- local moderation rules
- support provider moderation mode
- internal moderation endpoint

File utama:

- [ai-service/app/moderation.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/app/moderation.py:1)

### 4.4 Fallback Model

Sudah ditambahkan:

- model utama
- daftar fallback model
- retry ke fallback untuk error upstream retryable
- debug attempts di mode local

Konfigurasi lokal yang sudah dipakai:

- primary: `AC/DeepSeek-V4-Pro`
- fallback: `AC/auto`, `AC/DeepSeek-V4-Flash`

File utama:

- [ai-service/app/config.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/app/config.py:1)
- [ai-service/.env.example](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/.env.example:1)

## 5. Pekerjaan yang Sudah Selesai di Admin Panel

### 5.1 Filament Admin

Sudah dibuat:

- panel admin di path `/admin`
- login admin memakai halaman `/login` yang sama dengan user biasa
- pembatasan akses panel hanya untuk `role=admin`
- resource `Users`
- resource `Conversations`

Panel ini menggunakan tabel `users` yang sama dengan auth biasa.

Artinya:

- tidak ada tabel admin terpisah
- admin dan user tetap satu entitas user
- register publik tidak pernah membuat admin baru
- pembeda hanya field `role`
- admin tidak boleh mengakses halaman chat user

### 5.2 Frontend Chat Dasar

Sudah tersedia halaman `/chat` yang:

- mengambil daftar conversation dari backend
- mengambil detail conversation dari backend
- membuat conversation baru lewat backend
- mengirim message ke backend
- menampilkan balasan assistant dari backend

Dokumen kontrak frontend:

- [docs/frontend-chat-api.md](/home/panzek/project-pkl-deka/chatbot-deka/docs/frontend-chat-api.md:1)

File utama:

- [app/app/Providers/Filament/AdminPanelProvider.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Providers/Filament/AdminPanelProvider.php:1)
- [app/app/Filament/Resources/Users/UserResource.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Filament/Resources/Users/UserResource.php:1)
- [app/app/Filament/Resources/Conversations/ConversationResource.php](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Filament/Resources/Conversations/ConversationResource.php:1)
- [app/database/seeders/AdminUserSeeder.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/seeders/AdminUserSeeder.php:1)

## 6. Bug dan Risiko yang Sudah Ditemukan Lalu Diperbaiki

### 5.1 Driver Test dan App Key

Masalah awal:

- test gagal karena sqlite driver tidak tersedia
- test gagal karena app key belum ada

Perbaikan:

- testing diarahkan ke konfigurasi environment yang sesuai
- `app key` dan environment testing dibereskan

### 5.2 Korelasi Reply Assistant

Masalah:

- assistant reply awalnya berisiko salah terhubung ke user message jika ada retry atau concurrency

Perbaikan:

- ditambahkan `reply_to_message_id`
- korelasi assistant sekarang eksplisit

### 5.3 Response Usage Metadata

Masalah:

- response dari router model mengandung metadata nested
- schema AI service terlalu sempit sehingga validasi gagal

Perbaikan:

- schema `usage` diperlonggar agar menerima struktur nested

### 5.4 Single Model Dependency

Masalah:

- jika model utama unavailable, chatbot langsung gagal

Perbaikan:

- ditambahkan fallback model berurutan
- sekarang request bisa tetap sukses jika model cadangan tersedia

### 5.5 Observability Error Model

Masalah:

- error upstream model awalnya terlalu generik

Perbaikan:

- error lokal sekarang lebih informatif
- fallback exhaustion sekarang bisa menunjukkan model apa saja yang dicoba

## 7. Hasil Pengujian yang Sudah Berhasil

### Laravel

Sudah berhasil:

- migration berjalan
- feature test chat pernah lulus penuh
- unit test `AiServiceClient` lulus
- alur service chat berhasil diuji

File test:

- [app/tests/Feature/AuthApiTest.php](/home/panzek/project-pkl-deka/chatbot-deka/app/tests/Feature/AuthApiTest.php:1)
- [app/tests/Feature/ChatApiTest.php](/home/panzek/project-pkl-deka/chatbot-deka/app/tests/Feature/ChatApiTest.php:1)
- [app/tests/Unit/AiServiceClientTest.php](/home/panzek/project-pkl-deka/chatbot-deka/app/tests/Unit/AiServiceClientTest.php:1)
- [app/tests/Unit/UserRoleTest.php](/home/panzek/project-pkl-deka/chatbot-deka/app/tests/Unit/UserRoleTest.php:1)

Catatan:

- bila PostgreSQL lokal tidak hidup, feature test Laravel akan gagal karena koneksi database, bukan karena logika chat rusak

### AI Service

Sudah berhasil:

- health endpoint
- respond endpoint
- title endpoint
- moderation endpoint
- fallback model logic
- schema validation

File test:

- [ai-service/tests/test_main.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/tests/test_main.py:1)
- [ai-service/tests/test_llm.py](/home/panzek/project-pkl-deka/chatbot-deka/ai-service/tests/test_llm.py:1)

### Verifikasi Manual End-to-End

Sudah terbukti:

- `curl http://localhost:20127/v1/models` berhasil
- `POST /chat/respond` di `ai-service` berhasil `200 OK`
- assistant berhasil menjawab
- response usage metadata berhasil lolos validasi
- route admin Filament berhasil aktif
- assets Filament berhasil dipublish

Contoh hasil akhir yang sudah sukses:

- assistant reply berhasil dikembalikan
- model aktif terbaca sebagai `xopdeepseekv4flash`

## 8. Status Sistem Saat Ini

### Yang Sudah Aman

- auth API dasar
- role `admin` dan `user`
- admin panel dasar
- alur backend chat runtime
- persistence conversation dan message
- internal AI service integration
- moderation flow
- idempotency flow
- fallback model flow
- pengujian tanpa frontend

### Yang Belum Dikerjakan

- crawl `deka.dev`
- ingestion dokumen
- chunking knowledge
- vector store / pgvector
- retrieval API
- inject context knowledge Deka ke AI service
- pembatasan jawaban hanya ke knowledge Deka

### Arti Status Saat Ini

Sistem yang ada sekarang:

- sudah punya auth user dan panel admin
- sudah cocok sebagai fondasi chatbot backend
- belum final sebagai chatbot informasi Deka

Bahasa sederhananya:

> runtime chat, auth, dan admin panel-nya sudah jadi, knowledge bot Deka-nya belum dipasang.

## 9. Dokumen Arsitektur Lanjutan

Untuk tahap berikutnya, arsitektur backend final chatbot informasi Deka sudah didokumentasikan di:

- [docs/deka-chatbot-backend-architecture.md](/home/panzek/project-pkl-deka/chatbot-deka/docs/deka-chatbot-backend-architecture.md:1)

Dokumen itu membahas:

- arsitektur retrieval-first
- ingestion `deka.dev`
- vector storage
- retrieval flow
- perubahan AI service
- perubahan Laravel workflow

## 10. Kesimpulan

Pekerjaan yang sudah selesai bukan kecil. Fondasi backend inti sudah terbentuk:

- auth API sudah ada
- role dasar sudah ada
- admin panel sudah ada
- chat workflow sudah ada
- persistence sudah ada
- AI service sudah ada
- model integration sudah ada
- fallback dan guardrail utama sudah ada
- testing inti sudah ada

Tahap berikutnya bukan lagi membangun backend chat dari nol, tetapi mengubah backend ini menjadi:

> chatbot pengetahuan Deka yang jawabannya dibatasi oleh knowledge resmi Deka.
