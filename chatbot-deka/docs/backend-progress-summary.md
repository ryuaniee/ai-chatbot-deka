# Ringkasan Progres Backend

Dokumen ini merangkum kondisi backend yang sudah selesai dikerjakan.

## Yang Sudah Jadi

- auth API berbasis session
- role `admin` dan `user`
- panel admin Filament
- persistence `conversations` dan `messages`
- runtime AI langsung di Laravel via `laravel/ai`
- moderation
- rate limit
- idempotency
- fallback model
- endpoint chat JSON
- endpoint chat streaming SSE
- frontend chat dasar yang sudah terhubung ke backend

## Status Praktis Sistem

Saat ini sistem sudah cocok untuk:

- login/register user
- redirect user ke chat
- redirect admin ke panel admin
- membuat conversation
- mengirim message
- menerima balasan assistant
- stream jawaban assistant secara bertahap

Sistem belum final sebagai chatbot knowledge Deka karena retrieval knowledge belum ada.

## Komponen yang Sudah Dibangun

### Database Chat

Sudah ada:

- role pada `users`
- tabel `conversations`
- tabel `messages`
- `reply_to_message_id` untuk korelasi balasan assistant

File utama:

- [app/database/migrations/2026_07_13_200000_add_role_to_users_table.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/migrations/2026_07_13_200000_add_role_to_users_table.php:1)
- [app/database/migrations/2026_07_13_000000_create_conversations_and_messages_tables.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/migrations/2026_07_13_000000_create_conversations_and_messages_tables.php:1)
- [app/database/migrations/2026_07_13_120000_add_reply_to_message_id_to_messages_table.php](/home/panzek/project-pkl-deka/chatbot-deka/app/database/migrations/2026_07_13_120000_add_reply_to_message_id_to_messages_table.php:1)

### Auth dan Role

Sudah ada:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Kontrak auth yang penting:

- response menyertakan `role`
- response menyertakan `redirect_to`

### Chat API

Sudah ada endpoint:

- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/conversations/stream`
- `GET /api/conversations/{conversation}`
- `POST /api/conversations/{conversation}/messages`
- `POST /api/conversations/{conversation}/messages/stream`

### Service Layer

Service utama yang sudah ada:

- [ConversationChatService](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Services/ConversationChatService.php:1)
- [AiRuntimeClient](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Services/AiRuntimeClient.php:1)
- [MessageModerationService](/home/panzek/project-pkl-deka/chatbot-deka/app/app/Services/MessageModerationService.php:1)

Fungsi yang sudah tercakup:

- start conversation
- send message lanjutan
- persist user message
- generate assistant reply
- generate title
- stream assistant reply
- resume response aman untuk retry/idempotency

### Runtime AI

Migrasi dari service eksternal ke runtime Laravel sudah selesai.

Sekarang runtime AI berada langsung di app lewat:

- reply agent
- moderation agent
- title agent
- provider matrix primary/fallback

Konfigurasi utamanya ada di:

- [app/config/services.php](/home/panzek/project-pkl-deka/chatbot-deka/app/config/services.php:1)
- [app/.env.example](/home/panzek/project-pkl-deka/chatbot-deka/app/.env.example:1)

### Admin Panel

Sudah ada:

- panel Filament di `/admin`
- resource `Users`
- resource `Conversations`
- guard akses hanya untuk `role=admin`

## Guardrail yang Sudah Aktif

- moderation sebelum generation
- throttle chat
- throttle resend verification email
- throttle forgot password
- idempotency untuk endpoint POST chat
- mapping error runtime AI ke response HTTP yang stabil

## Perbaikan yang Sudah Masuk

Beberapa perbaikan penting yang sekarang sudah tertutup:

- korelasi assistant reply sekarang eksplisit lewat `reply_to_message_id`
- fallback model sudah aktif
- stream dan non-stream sama-sama menyimpan final assistant message
- optimistic UI stream sekarang rollback jika request gagal sebelum stream benar-benar mulai
- test SSE sekarang ada

## Hasil Pengujian

Sudah diverifikasi:

- unit test `AiRuntimeClient`
- feature test `ChatApiTest`
- jalur chat JSON
- jalur chat stream SSE

Command yang dipakai:

```bash
cd app
php artisan test --filter='ChatApiTest|AiRuntimeClientTest'
```

## Yang Belum Dikerjakan

- crawl `deka.dev`
- ingestion dokumen
- chunking knowledge
- vector store / `pgvector`
- retrieval
- inject context knowledge Deka ke runtime AI
- pembatasan jawaban agar hanya berasal dari knowledge Deka

## Ringkasan Singkat

Bahasa sederhananya:

> auth, admin panel, runtime AI Laravel, chat biasa, dan chat stream sudah jadi; knowledge bot Deka masih tahap berikutnya.
