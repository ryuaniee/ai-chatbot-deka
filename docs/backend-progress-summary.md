# Ringkasan Progress Backend Chatbot Deka

Dokumen ini merangkum progress backend Chatbot Deka sampai kondisi terbaru di repo. Fokus backend saat ini sudah bergeser dari chat umum berbasis Laravel AI menjadi chat yang siap memakai knowledge base Deka dengan pendekatan RAG.

## Status Akhir

Backend utama sudah bisa dipakai untuk alur chat dan sudah mulai masuk tahap knowledge/RAG:

- auth user, login, logout, cek sesi, dan halaman chat
- conversation dan message tersimpan di PostgreSQL
- assistant reply dibuat lewat runtime AI Laravel
- chat berjalan lewat response JSON dan streaming SSE
- moderation, throttle, idempotency, ownership check, dan error mapping sudah aktif
- knowledge base Deka versi lama sudah dihapus
- knowledge base versi baru sudah punya schema, model, service ingestion, service retrieval, dan test RAG
- PostgreSQL lokal sudah disiapkan memakai image `pgvector/pgvector:pg17`
- knowledge bisa diambil dari file lokal atau website crawl
- retrieval diarahkan memakai `pgvector` dan PostgreSQL full-text search

## Timeline Pengerjaan

Progress backend dikerjakan bertahap dari fondasi aplikasi sampai persiapan knowledge base:

| Tahap | Progress |
| --- | --- |
| Fondasi | Setup aplikasi Laravel, koneksi PostgreSQL, dan Docker Compose lokal |
| Auth | Session auth API untuk register, login, logout, cek user, dan Google OAuth |
| Chat | Tabel conversation/message, endpoint chat JSON, endpoint streaming SSE, dan idempotency |
| Runtime AI | Integrasi Laravel AI SDK untuk reply, moderation, title agent, provider config, dan error mapping |
| Knowledge RAG | Reset knowledge lama, persiapan pgvector, ingestion file/website, retrieval pgvector/full-text, dan test RAG |

## Arsitektur Saat Ini

Alur backend saat ini:

1. Frontend mengirim request ke Laravel routes dan controller.
2. Controller meneruskan proses ke `ConversationChatService`.
3. Service menjalankan moderation, mengambil context knowledge jika aktif, lalu memanggil runtime AI.
4. Runtime AI memakai Laravel AI agent dan provider OpenAI-compatible.
5. Conversation, message, metadata AI, dan metadata knowledge disimpan ke PostgreSQL.
6. Knowledge ingestion mengambil konten dari file atau website, membersihkan teks, memecah chunk, lalu menyimpannya ke tabel knowledge untuk kebutuhan retrieval.

## Alur Chat JSON

Alur chat non-stream:

1. User mengirim pesan melalui endpoint chat.
2. Backend menjalankan moderation dan menyimpan user message.
3. Backend mencari context knowledge yang relevan.
4. Jika context tersedia, context disisipkan sebagai `DEKA_KNOWLEDGE_CONTEXT`.
5. Runtime AI membuat balasan assistant.
6. Backend menyimpan assistant message, usage/model metadata, dan source knowledge.
7. API mengembalikan response JSON ke frontend.

## Alur Chat Streaming

Alur chat streaming:

1. User mengirim pesan melalui endpoint streaming.
2. Backend menyimpan user message dan mengambil context knowledge.
3. Runtime AI mengirim balasan secara bertahap melalui SSE.
4. Frontend menerima event `conversation_started`, `text_delta`, dan `message_complete`.
5. Setelah stream selesai, backend menyimpan final assistant message beserta metadata.

## Komponen Backend

### Auth dan Role

Endpoint auth yang tersedia:

- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /auth/google`
- `GET /auth/google/callback`

Perilaku utama:

- auth memakai session cookie
- response auth menyertakan `role`
- response auth menyertakan `redirect_to`
- user biasa diarahkan ke `/chat`
- update profile sekarang redirect kembali ke halaman asal, bukan selalu ke halaman profile

### Chat API

Endpoint conversation:

- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/conversations/stream`
- `GET /api/conversations/{conversation}`
- `POST /api/conversations/{conversation}/messages`
- `POST /api/conversations/{conversation}/messages/stream`

Fitur chat yang sudah aktif:

- membuat conversation kosong
- membuat conversation dengan first message
- mengirim message lanjutan
- mengambil list conversation milik user
- mengambil detail conversation beserta messages
- menyimpan assistant reply
- stream balasan assistant lewat SSE
- menyimpan metadata model, usage, dan knowledge source pada assistant message

### Runtime AI

Runtime AI berada langsung di Laravel lewat `laravel/ai`.

Agent yang sudah ada:

- `ConversationReplyAgent`
- `MessageModerationAgent`
- `ConversationTitleAgent`

Service utama:

- [ConversationChatService](/home/panzek/project-pkl-deka/app/Services/ConversationChatService.php:1)
- [AiRuntimeClient](/home/panzek/project-pkl-deka/app/Services/AiRuntimeClient.php:1)
- [MessageModerationService](/home/panzek/project-pkl-deka/app/Services/MessageModerationService.php:1)

Catatan perubahan terbaru:

- `AiRuntimeClient` tidak lagi menerima knowledge context sebagai parameter terpisah
- context knowledge sekarang masuk sebagai message tambahan `DEKA_KNOWLEDGE_CONTEXT`
- prompt agent diarahkan untuk menjawab fakta Deka hanya dari context tersebut
- kalau context tidak cukup, agent diminta mengikuti fallback wording yang diberikan service

## Knowledge Base dan RAG

Implementasi knowledge lama yang spesifik `DekaKnowledge*` sudah dihapus dan diganti dengan service yang lebih umum:

- [KnowledgeIngestor](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeIngestor.php:1)
- [KnowledgeRetriever](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeRetriever.php:1)
- [KnowledgeTextExtractor](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeTextExtractor.php:1)
- [KnowledgeChunker](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeChunker.php:1)

### Ingestion

Command ingestion yang tersedia:

- `php artisan knowledge:ingest-file {path}`
- `php artisan knowledge:crawl --base=https://deka.dev --limit=50 --fresh`

Kemampuan ingestion:

- ingest file `txt`, `md`, `markdown`, `html`, `pdf`, dan `docx`
- crawl website dari sitemap atau internal link halaman utama
- ekstrak text dari HTML dengan membersihkan script, style, nav, footer, header, form, dan elemen non-konten lain
- pecah konten menjadi chunk dengan ukuran dan overlap dari config
- simpan hash dokumen, hash chunk, token estimate, metadata, dan data pendukung retrieval
- catat proses pada tabel `knowledge_ingestion_runs`

### Retrieval

Mode retrieval yang ditulis sebagai target progress:

- `pgvector`: memakai kolom vector PostgreSQL untuk pencarian similarity
- `fulltext`: memakai PostgreSQL full-text search, fallback term search, dan fallback LIKE untuk non-PostgreSQL

Perilaku retrieval:

- jika `DEKA_KNOWLEDGE_ENABLED=false`, chat tetap berjalan tanpa context knowledge
- jika aktif dan ada context yang melewati threshold, context disisipkan sebelum prompt user
- jika aktif tetapi tidak ada context relevan, service menyisipkan fallback context agar AI tidak menjawab dari pengetahuan umum
- source knowledge disimpan ke metadata assistant message
- query tertentu seperti profil Deka, kontak/alamat, dan pendiri punya prioritas lookup agar jawaban lebih stabil

Konfigurasi utama:

- `DEKA_KNOWLEDGE_ENABLED`
- `DEKA_KNOWLEDGE_RETRIEVAL_MODE`
- `DEKA_KNOWLEDGE_BASE_URL`
- `DEKA_KNOWLEDGE_TOP_K`
- `DEKA_KNOWLEDGE_MIN_SIMILARITY`
- `DEKA_KNOWLEDGE_MIN_FULLTEXT_SCORE`
- `DEKA_KNOWLEDGE_MAX_CONTEXT_CHARACTERS`
- `DEKA_KNOWLEDGE_CHUNK_SIZE`
- `DEKA_KNOWLEDGE_CHUNK_OVERLAP`

## Database

Tabel utama backend chat:

- `users`
- `conversations`
- `messages`
- `cache`
- `jobs`
- `sessions`

Tabel knowledge baru:

- `knowledge_documents`
- `knowledge_chunks`
- `knowledge_ingestion_runs`

Migration penting:

- [create_users_table](/home/panzek/project-pkl-deka/database/migrations/0001_01_01_000000_create_users_table.php:1)
- [create_cache_table](/home/panzek/project-pkl-deka/database/migrations/0001_01_01_000001_create_cache_table.php:1)
- [create_jobs_table](/home/panzek/project-pkl-deka/database/migrations/0001_01_01_000002_create_jobs_table.php:1)
- [create_conversations_and_messages_tables](/home/panzek/project-pkl-deka/database/migrations/2026_07_13_000000_create_conversations_and_messages_tables.php:1)
- [add_reply_to_message_id_to_messages_table](/home/panzek/project-pkl-deka/database/migrations/2026_07_13_120000_add_reply_to_message_id_to_messages_table.php:1)
- [add_role_to_users_table](/home/panzek/project-pkl-deka/database/migrations/2026_07_13_200000_add_role_to_users_table.php:1)
- [add_google_id_to_users_table](/home/panzek/project-pkl-deka/database/migrations/2026_07_14_160000_add_google_id_to_users_table.php:1)
- [create_deka_knowledge_tables](/home/panzek/project-pkl-deka/database/migrations/2026_07_17_000000_create_deka_knowledge_tables.php:1)

Perubahan database terbaru:

- Docker Compose memakai `pgvector/pgvector:pg17`
- migration knowledge memastikan extension `vector` tersedia saat driver PostgreSQL
- `knowledge_chunks` menyiapkan kolom vector untuk kebutuhan `pgvector`
- fallback database non-PostgreSQL memakai JSON untuk data vector
- index vector dibuat untuk retrieval berbasis `pgvector`
- index full-text dibuat untuk retrieval berbasis text

## Guardrail

Guardrail yang sudah aktif:

- moderation sebelum AI generation
- throttle endpoint chat
- throttle login/register/reset/verifikasi email
- idempotency untuk endpoint POST chat
- ownership check agar user tidak bisa membaca conversation user lain
- error runtime AI dikembalikan sebagai response HTTP yang stabil
- optimistic UI frontend rollback jika stream gagal sebelum mulai
- knowledge fallback ketika pertanyaan di luar konteks Deka atau context tidak ditemukan

## Error Handling

Mapping error runtime AI:

| Kondisi | Response |
| --- | --- |
| konfigurasi AI salah | `503 AI_RUNTIME_MISCONFIGURED` |
| provider overload | `503 AI_PROVIDER_OVERLOADED` |
| rate limited | `429 AI_PROVIDER_RATE_LIMITED` |
| upstream gagal | `502/503 AI_RUNTIME_UNAVAILABLE` |
| idempotency key dipakai ulang dengan payload beda | `409 IDEMPOTENCY_KEY_REUSED` |
| message diblokir moderation | `422` dengan reason code moderation |

Penjelasan `rate limited`:

`Rate limited` berarti request ditolak sementara karena jumlah request sudah melewati batas yang diizinkan dalam periode tertentu. Untuk endpoint chat, pembatasan dihitung berdasarkan kombinasi akun user dan IP address. Jika user belum login, pembatasan memakai IP address sebagai identitas guest. Batas default chat adalah `20` request per menit melalui konfigurasi `AI_CHAT_RATE_LIMIT_PER_MINUTE`.

Untuk login, pembatasan memakai kombinasi email/username dan IP address dengan batas default `5` request per menit. Rate limit ini dipakai untuk menjaga service tetap stabil, mencegah spam, mengurangi brute force login, dan menghindari beban berlebihan ke provider AI. Jika kondisi ini terjadi, API mengembalikan HTTP `429` agar frontend bisa meminta user menunggu sebentar sebelum mencoba lagi.

Error handling knowledge:

- file knowledge tidak ditemukan akan menghentikan command ingestion
- ekstensi file tidak didukung akan mengembalikan error dari command
- konten terlalu pendek tidak akan diingest
- retrieval gagal akan dicatat ke log dan dianggap tidak menemukan context
- run ingestion gagal disimpan sebagai `failed` beserta `error_message`

## Testing

Test utama yang relevan:

```bash
php artisan test --filter='ChatApiTest|AiRuntimeClientTest|DekaKnowledgeRagTest|ProfileUpdateTest'
```

Lingkup test yang sudah ada:

- auth user untuk chat API
- create/list/show conversation
- send message JSON
- stream first message
- stream message lanjutan
- moderation blocked message
- idempotency replay
- idempotency conflict
- retry failure behavior
- runtime AI error mapping
- unit test `AiRuntimeClient`
- ingest knowledge menjadi document dan chunk
- retrieval `pgvector` di atas threshold
- retrieval `pgvector` di bawah threshold
- fallback ketika retrieval tidak menemukan context
- mode full-text tanpa proses vector
- chat prompt menyisipkan `DEKA_KNOWLEDGE_CONTEXT`
- metadata source knowledge tersimpan di assistant message
- fallback Deka-only ketika context kosong
- profile update redirect kembali ke halaman asal

Catatan: hasil angka test bisa berubah sesuai kondisi database lokal, tetapi suite yang perlu diverifikasi untuk progress backend terbaru adalah filter di atas.

## File Penting

| Area | File |
| --- | --- |
| Routes | [routes/web.php](/home/panzek/project-pkl-deka/routes/web.php:1) |
| Auth API | [AuthApiController.php](/home/panzek/project-pkl-deka/app/Http/Controllers/AuthApiController.php:1) |
| Chat JSON | [ConversationController.php](/home/panzek/project-pkl-deka/app/Http/Controllers/ConversationController.php:1) |
| Chat Message | [ConversationMessageController.php](/home/panzek/project-pkl-deka/app/Http/Controllers/ConversationMessageController.php:1) |
| Chat Stream | [ConversationStreamController.php](/home/panzek/project-pkl-deka/app/Http/Controllers/ConversationStreamController.php:1) |
| Chat Service | [ConversationChatService.php](/home/panzek/project-pkl-deka/app/Services/ConversationChatService.php:1) |
| AI Runtime | [AiRuntimeClient.php](/home/panzek/project-pkl-deka/app/Services/AiRuntimeClient.php:1) |
| Moderation | [MessageModerationService.php](/home/panzek/project-pkl-deka/app/Services/MessageModerationService.php:1) |
| Reply Agent | [ConversationReplyAgent.php](/home/panzek/project-pkl-deka/app/Ai/Agents/ConversationReplyAgent.php:1) |
| Knowledge Ingestor | [KnowledgeIngestor.php](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeIngestor.php:1) |
| Knowledge Retriever | [KnowledgeRetriever.php](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeRetriever.php:1) |
| Knowledge Extractor | [KnowledgeTextExtractor.php](/home/panzek/project-pkl-deka/app/Services/Knowledge/KnowledgeTextExtractor.php:1) |
| Knowledge Migration | [create_deka_knowledge_tables](/home/panzek/project-pkl-deka/database/migrations/2026_07_17_000000_create_deka_knowledge_tables.php:1) |
| RAG Tests | [DekaKnowledgeRagTest.php](/home/panzek/project-pkl-deka/tests/Feature/DekaKnowledgeRagTest.php:1) |
| Chat Tests | [ChatApiTest.php](/home/panzek/project-pkl-deka/tests/Feature/ChatApiTest.php:1) |

## Next Development Backend

Pengembangan backend berikutnya difokuskan pada penguatan knowledge/RAG, observability, admin control, dan evaluasi kualitas jawaban.

### 1. Validasi Knowledge/RAG dengan Data Asli Deka

Backend perlu diuji memakai data resmi Deka agar fitur RAG tidak hanya berjalan secara teknis, tetapi juga menghasilkan jawaban yang benar.

- jalankan command `knowledge:crawl` ke website Deka asli
- pastikan hasil crawl bersih dari noise seperti navbar, footer, script, dan konten berulang
- uji apakah jawaban chatbot benar-benar memakai knowledge base, bukan pengetahuan umum AI
- cek source knowledge yang tersimpan pada metadata assistant message

### 2. Rapikan dan Sinkronkan Dokumentasi

Dokumentasi perlu dibuat konsisten agar status backend mudah dipahami saat laporan atau presentasi.

- samakan status README, arsitektur backend, dan ringkasan progress backend
- perbarui bagian knowledge agar sesuai dengan kondisi terbaru
- tambahkan catatan fitur yang sudah aktif dan fitur yang masih tahap pengembangan
- pastikan command, endpoint, dan konfigurasi `.env` yang ditulis sudah sesuai dengan repo

### 3. Tambah Endpoint Health Check

Health check berguna untuk memastikan service penting backend masih berjalan normal.

- tambah endpoint seperti `/api/health`, `/api/health/ai`, dan `/api/health/knowledge`
- cek koneksi database, runtime AI, dan retrieval knowledge
- gunakan response JSON sederhana agar mudah dipakai frontend atau admin
- bedakan status sehat, warning, dan gagal agar error lebih mudah dilacak

### 4. Tambah Admin UI untuk Knowledge Base

Admin perlu fitur untuk memantau dan mengelola data knowledge tanpa harus selalu memakai command line.

- tampilkan daftar dokumen knowledge
- tampilkan chunk hasil ingestion
- sediakan aksi untuk menjalankan ulang crawl atau ingest file
- tampilkan status ingestion seperti sukses, gagal, jumlah halaman, dan error
- tampilkan waktu terakhir crawl dan sumber dokumen

### 5. Tambah Logging dan Monitoring

Logging membantu mengevaluasi performa dan memudahkan debugging ketika chatbot memberi jawaban yang kurang tepat.

- simpan durasi request AI
- simpan durasi retrieval knowledge
- simpan jumlah token atau panjang context yang dipakai
- simpan source knowledge yang dipakai untuk menjawab
- catat error dari provider AI dan retrieval agar lebih mudah dianalisis

### 6. Perkuat Testing Backend

Test perlu diperluas karena backend sudah menyentuh auth, chat, streaming, AI runtime, dan knowledge retrieval.

- tambah test untuk command crawl website
- tambah test ingest file PDF dan DOCX
- tambah test Google OAuth callback
- tambah test resend email verification
- tambah test fallback jika provider AI error
- tambah test retrieval ketika context kosong atau tidak relevan

### 7. Evaluasi Threshold Retrieval

Nilai threshold perlu disesuaikan setelah data knowledge asli masuk agar chatbot tidak memakai context yang lemah.

- evaluasi `DEKA_KNOWLEDGE_TOP_K`
- evaluasi `DEKA_KNOWLEDGE_MIN_SIMILARITY`
- evaluasi `DEKA_KNOWLEDGE_MIN_FULLTEXT_SCORE`
- catat konfigurasi terbaik berdasarkan hasil uji pertanyaan nyata
- bandingkan hasil mode `pgvector` dan `fulltext`

### 8. Tambahkan Fitur Feedback Jawaban

Feedback dari user bisa dipakai untuk menilai kualitas jawaban chatbot secara langsung.

- user bisa menandai jawaban sebagai membantu atau tidak membantu
- feedback disimpan bersama pesan dan conversation
- admin bisa melihat jawaban yang sering dinilai kurang membantu
- feedback bisa dipakai untuk menentukan data knowledge mana yang perlu diperbaiki

### 9. Buat Evaluasi Kualitas Jawaban

Evaluasi kualitas diperlukan agar pengembangan tidak hanya berdasarkan asumsi, tetapi berdasarkan daftar pertanyaan uji.

- siapkan daftar pertanyaan tentang Deka
- tentukan jawaban ideal untuk tiap pertanyaan
- bandingkan jawaban chatbot dengan jawaban ideal
- catat pertanyaan yang gagal dijawab karena knowledge belum lengkap
- pakai hasil evaluasi untuk memperbaiki crawl, chunking, retrieval, dan prompt fallback

## Ringkasan

Backend utama sudah siap untuk alur chat berbasis Laravel, dan fondasi RAG Deka sudah mulai terbentuk:

> auth, database chat, runtime AI, JSON chat, stream SSE, guardrail, knowledge ingestion, retrieval pgvector/full-text, dan test RAG sudah tersedia di repo.
