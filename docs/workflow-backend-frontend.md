# Workflow Backend dan Frontend Chatbot Deka

Dokumen ini merangkum workflow fitur backend dan frontend yang sudah tersedia di repo Chatbot Deka. Fokusnya adalah alur kerja sistem dari user membuka aplikasi, login, chat dengan AI, pemberian feedback, sampai admin memantau dan mengelola data.

## Gambaran Umum

Stack aplikasi:

- Backend: Laravel
- Frontend: React + Inertia
- Database: PostgreSQL
- Auth: Laravel session auth + Fortify
- AI runtime: Laravel AI SDK
- Knowledge retrieval: tabel knowledge dengan dukungan PostgreSQL full-text dan pgvector
- UI admin: halaman Inertia React di `/admin/{section}`

Alur besar sistem:

```text
User / Admin
   -> Frontend React + Inertia
   -> Laravel route/controller
   -> Service layer
   -> Database / AI runtime / knowledge retrieval
   -> Response JSON, Inertia props, atau SSE stream
   -> Frontend memperbarui tampilan
```

## Workflow Auth

Auth memakai session cookie Laravel, bukan bearer token.

### Register

```text
User mengisi form register
   -> frontend kirim data ke backend
   -> backend validasi data user
   -> backend normalisasi email
   -> user dibuat di database
   -> event Registered dijalankan
   -> user langsung login
   -> session diregenerasi
   -> backend mengembalikan user payload dan redirect_to
   -> frontend mengarahkan user sesuai role
```

Route utama:

- `POST /api/auth/register`

File utama:

- `app/Http/Controllers/AuthApiController.php`
- `app/Actions/Fortify/CreateNewUser.php`
- `resources/js/pages/auth/register.tsx`

### Login

```text
User mengisi email dan password
   -> frontend kirim request login
   -> backend normalisasi email
   -> backend cek two-factor challenge jika aktif
   -> backend cari user memakai canonical_email
   -> backend verifikasi password
   -> backend membuat session login
   -> backend mengembalikan redirect_to
   -> user biasa masuk /chat
   -> admin masuk /admin
```

Route utama:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Role guard:

- Admin tidak boleh masuk area chat user.
- User biasa tidak boleh masuk area admin.

File utama:

- `app/Http/Middleware/EnsureAdminUser.php`
- `app/Http/Middleware/EnsureRegularUser.php`
- `resources/js/pages/auth/login.tsx`

## Workflow Chat User

Halaman utama user biasa adalah `/chat`.

### Membuka Halaman Chat

```text
User membuka /chat
   -> middleware auth, verified, regular-user berjalan
   -> Laravel render halaman Inertia chat
   -> frontend mengambil daftar conversation
   -> frontend menampilkan sidebar riwayat chat
   -> user bisa memilih percakapan lama atau membuat chat baru
```

Route utama:

- `GET /chat`
- `GET /api/conversations`
- `GET /api/conversations/{conversation}`

File utama:

- `routes/web.php`
- `app/Http/Controllers/ConversationController.php`
- `resources/js/pages/chat.tsx`

### Membuat Percakapan Baru

```text
User mengetik pesan pertama
   -> frontend membuat temporary user message
   -> frontend membuka request stream ke /api/conversations/stream
   -> backend validasi content
   -> backend menjalankan moderation
   -> backend membuat conversation
   -> backend menyimpan user message
   -> backend menyiapkan context knowledge jika aktif
   -> backend membuka stream AI
   -> frontend menerima event conversation_started
   -> frontend menerima text_delta bertahap
   -> backend menyimpan final assistant message
   -> frontend menerima message_complete
   -> sidebar dan isi chat diperbarui
```

Route utama:

- `POST /api/conversations/stream`
- `POST /api/conversations`

File utama:

- `app/Http/Controllers/ConversationStreamController.php`
- `app/Http/Controllers/ConversationController.php`
- `app/Services/ConversationChatService.php`
- `resources/js/pages/chat.tsx`

### Mengirim Pesan Lanjutan

```text
User memilih conversation lama
   -> frontend mengambil detail conversation
   -> user mengirim pesan baru
   -> frontend membuka stream ke /api/conversations/{conversation}/messages/stream
   -> backend memastikan conversation milik user tersebut
   -> backend validasi content
   -> backend menjalankan moderation
   -> backend menyimpan user message dengan sequence lanjutan
   -> backend membangun history chat terbatas
   -> backend mengambil context knowledge
   -> backend memanggil AI runtime
   -> assistant reply dikirim sebagai stream
   -> final reply disimpan ke database
```

Route utama:

- `POST /api/conversations/{conversation}/messages/stream`
- `POST /api/conversations/{conversation}/messages`

### Streaming SSE

Event yang dipakai frontend:

```text
conversation_started
text_delta
message_complete
[DONE]
```

Alur event:

```text
backend emit conversation_started
   -> frontend memasukkan conversation dan user message
backend emit text_delta berkali-kali
   -> frontend menambahkan teks assistant secara live
backend emit message_complete
   -> frontend mengganti temporary assistant message dengan data final
backend emit [DONE]
   -> frontend menutup loading state
```

Fallback stream:

- Jika stream gagal sebelum ada teks, backend mencoba recovery memakai non-stream reply.
- Jika provider tetap gagal, backend menyimpan fallback message.
- Jika stream gagal setelah sebagian teks keluar, backend menyimpan fallback message agar percakapan tetap punya respons final.

## Workflow AI Runtime

```text
ConversationChatService
   -> moderation
   -> ambil history pesan
   -> normalisasi query knowledge
   -> retrieval knowledge
   -> sisipkan DEKA_KNOWLEDGE_CONTEXT
   -> panggil AiRuntimeClient
   -> simpan assistant message
   -> simpan metadata model, usage token, dan source knowledge
```

Agent yang digunakan:

- Conversation reply agent
- Message moderation agent
- Conversation title agent
- Knowledge intent planner
- Knowledge search query agent
- Knowledge candidate reranker

File utama:

- `app/Services/ConversationChatService.php`
- `app/Services/AiRuntimeClient.php`
- `app/Services/MessageModerationService.php`
- `app/Ai/Agents`

## Workflow Knowledge / RAG

Knowledge digunakan agar jawaban chatbot bersumber dari data Deka, bukan pengetahuan umum model.

### Ingestion File

```text
Admin/developer menjalankan command ingest file
   -> backend membaca file knowledge
   -> extractor mengambil teks dari txt, md, html, pdf, atau docx
   -> teks dinormalisasi
   -> chunker memecah teks menjadi potongan kecil
   -> embedding dibuat jika mode vector aktif
   -> dokumen disimpan ke knowledge_documents
   -> chunk disimpan ke knowledge_chunks
   -> proses dicatat ke knowledge_ingestion_runs
```

Command:

```bash
php artisan knowledge:ingest-file {path}
```

File utama:

- `app/Console/Commands/IngestKnowledgeFile.php`
- `app/Services/Knowledge/KnowledgeTextExtractor.php`
- `app/Services/Knowledge/KnowledgeIngestor.php`
- `app/Services/Knowledge/KnowledgeChunker.php`

### Crawl Website

```text
Command crawl dijalankan
   -> backend mengambil sitemap atau internal link website
   -> setiap halaman dibaca
   -> HTML dibersihkan dari script, style, nav, header, footer, dan form
   -> konten hasil ekstraksi diingest seperti file biasa
   -> hasil crawl disimpan sebagai dokumen dan chunk
   -> statistik run disimpan
```

Command:

```bash
php artisan knowledge:crawl --base=https://deka.dev --limit=50
```

File utama:

- `app/Console/Commands/CrawlKnowledgeWebsite.php`
- `app/Services/Knowledge/KnowledgeTextExtractor.php`
- `app/Services/Knowledge/KnowledgeIngestor.php`

### Retrieval Saat Chat

```text
User bertanya
   -> query dinormalisasi
   -> intent knowledge disusun
   -> retriever mencari chunk relevan
   -> kandidat bisa diseleksi/rerank
   -> context diformat sebagai DEKA_KNOWLEDGE_CONTEXT
   -> AI menjawab hanya dari context yang tersedia
   -> source knowledge disimpan di metadata assistant message
```

Jika context tidak cukup:

```text
retrieval lemah/kosong
   -> backend mengirim fallback context
   -> AI diarahkan untuk jujur bahwa informasi belum tersedia
```

File utama:

- `app/Services/Knowledge/KnowledgeRetriever.php`
- `app/Services/Knowledge/DekaKnowledgeQueryNormalizer.php`
- `app/Services/ConversationChatService.php`

Database knowledge:

- `knowledge_documents`
- `knowledge_chunks`
- `knowledge_ingestion_runs`

## Workflow Feedback Chat

User bisa memberi like atau dislike pada jawaban assistant.

```text
User klik like/dislike
   -> frontend menyimpan state feedback lokal
   -> frontend kirim request feedback ke backend
   -> backend memastikan conversation milik user
   -> backend memastikan message adalah assistant message
   -> backend menyimpan atau menghapus feedback
   -> dislike masuk status open untuk direview admin
   -> like dianggap resolved
```

Route utama:

- `POST /api/conversations/{conversation}/messages/{message}/feedback`

Data yang disimpan:

- message id
- user id
- type: `like` atau `dislike`
- reason untuk dislike
- review status
- admin decision
- admin note
- AI improvement jika diselesaikan admin

File utama:

- `app/Http/Controllers/MessageFeedbackController.php`
- `app/Models/MessageFeedback.php`
- `resources/js/pages/chat.tsx`

## Workflow Admin Dashboard

Halaman admin tersedia di `/admin/{section}` dan dilindungi middleware `auth`, `verified`, dan `admin-user`.

Section admin yang sudah tersedia:

- `overview`
- `token-usage`
- `feedback-review`
- `users`
- `roles`
- `activity-log`

### Membuka Dashboard Admin

```text
Admin membuka /admin
   -> route redirect ke /admin/overview
   -> middleware memastikan user adalah admin
   -> AdminDashboardController menerima section
   -> AdminDashboardService menyusun props
   -> Inertia render resources/js/pages/admin.tsx
   -> frontend menampilkan panel sesuai section aktif
```

File utama:

- `app/Http/Controllers/AdminDashboardController.php`
- `app/Services/AdminDashboardService.php`
- `resources/js/pages/admin.tsx`

### Overview

Data yang ditampilkan:

- total percakapan
- total like
- total dislike
- user aktif
- grafik tren percakapan
- grafik feedback
- ringkasan token
- ringkasan knowledge

Alur:

```text
Admin buka overview
   -> service menghitung metric dari conversations, messages, feedback, users, dan knowledge
   -> data dikirim sebagai Inertia props
   -> frontend render cards dan chart
```

### Token Usage

```text
Admin buka token usage
   -> service membaca assistant message metadata
   -> usage token dihitung per user
   -> trend token 30 hari dihitung
   -> frontend menampilkan tabel dan chart
```

Data token berasal dari metadata assistant message:

- prompt tokens
- completion tokens
- total tokens
- model

### Feedback Review

```text
Admin buka feedback review
   -> service mengambil feedback dislike
   -> frontend menampilkan pertanyaan, jawaban, alasan user, dan status review
   -> admin bisa mengubah status
   -> admin bisa solve atau ignore
```

Solve feedback:

```text
Admin klik solve
   -> backend memanggil FeedbackImprovementService
   -> AI membuat saran perbaikan jawaban
   -> feedback ditandai resolved
   -> admin decision dan improvement disimpan
   -> frontend memperbarui item review
```

Ignore feedback:

```text
Admin klik ignore
   -> backend menyimpan admin note
   -> feedback ditandai ignored
   -> frontend memperbarui status
```

Route utama:

- `PATCH /admin/feedback-review/{feedback}/status`
- `POST /admin/feedback-review/{feedback}/solve`
- `POST /admin/feedback-review/{feedback}/ignore`

File utama:

- `app/Http/Controllers/AdminDashboardController.php`
- `app/Services/FeedbackImprovementService.php`
- `resources/js/pages/admin.tsx`

### User Management

```text
Admin buka section users
   -> service mengambil daftar user
   -> frontend menampilkan tabel user
   -> admin bisa tambah user
   -> admin bisa edit user
   -> admin bisa hapus user
   -> backend validasi email, role, password, dan email_verified
   -> backend mencatat activity log
```

Validasi penting:

- email dinormalisasi
- canonical email harus unik
- role harus ada di tabel `roles`
- minimal harus ada satu admin aktif
- admin tidak bisa menghapus akun sendiri

Route utama:

- `POST /admin/users`
- `PUT /admin/users/{user}`
- `DELETE /admin/users/{user}`

File utama:

- `app/Http/Controllers/AdminUserController.php`
- `resources/js/pages/admin.tsx`

### Role Management

```text
Admin buka section roles
   -> service mengambil role dan jumlah user per role
   -> frontend menampilkan role
   -> admin bisa tambah role
   -> admin bisa edit nama, deskripsi, dan permissions
   -> admin bisa hapus role non-system jika tidak dipakai user
   -> backend mencatat activity log
```

Validasi penting:

- slug dibuat dengan `Str::slug`
- slug wajib unik
- permissions dibersihkan dari nilai kosong dan duplikat
- role bawaan tidak bisa dihapus
- role yang masih dipakai user tidak bisa dihapus

Route utama:

- `POST /admin/roles`
- `PUT /admin/roles/{role}`
- `DELETE /admin/roles/{role}`

File utama:

- `app/Http/Controllers/AdminRoleController.php`
- `app/Models/Role.php`
- `resources/js/pages/admin.tsx`

### Activity Log

```text
Admin membuka activity log
   -> service mengambil log aktivitas admin
   -> frontend menampilkan daftar log
   -> admin bisa filter periode dan search
   -> frontend bisa refresh data via endpoint JSON
   -> admin bisa export/print report
```

Route utama:

- `GET /admin/activity-log/items`
- `GET /admin/activity-log/report`

Data log mencatat:

- admin
- kategori
- aksi
- target
- deskripsi
- IP address
- user agent
- waktu

File utama:

- `app/Models/AdminActivityLog.php`
- `app/Services/AdminDashboardService.php`
- `resources/views/admin/reports/activity-log.blade.php`
- `resources/js/pages/admin.tsx`

## Workflow Frontend

### Frontend Chat

Tanggung jawab halaman chat:

- mengambil daftar conversation
- mengelompokkan conversation berdasarkan waktu
- membuka detail conversation
- mengirim pesan dengan SSE stream
- menampilkan assistant reply secara bertahap
- menangani loading, error, dan abort stream
- menyimpan state feedback sementara di `localStorage`
- mengirim feedback ke backend
- menampilkan modal setting dan logout confirmation

File utama:

- `resources/js/pages/chat.tsx`
- `resources/js/components/settings-modal.tsx`
- `resources/js/components/logout-confirm-modal.tsx`

### Frontend Admin

Tanggung jawab halaman admin:

- navigasi antar section admin
- render metric card, chart, tabel, dan dialog
- CRUD user
- CRUD role
- review feedback
- filter dan export activity log
- menampilkan status knowledge dan runtime

File utama:

- `resources/js/pages/admin.tsx`
- `resources/js/components/admin-conversation-chart.tsx`
- `resources/js/components/admin-feedback-bar-chart.tsx`
- `resources/js/components/admin-token-usage-chart.tsx`
- `resources/js/components/admin-token-trend-chart.tsx`

## Workflow Database

Tabel utama:

- `users`: data user, role, email verification, two-factor
- `roles`: data role admin/user/custom
- `conversations`: sesi percakapan user
- `messages`: pesan user dan assistant
- `message_feedback`: like/dislike dan review feedback
- `admin_activity_logs`: audit aktivitas admin
- `knowledge_documents`: dokumen sumber knowledge
- `knowledge_chunks`: potongan knowledge untuk retrieval
- `knowledge_ingestion_runs`: catatan proses ingestion/crawl

Relasi utama:

```text
users
   -> conversations
      -> messages
         -> message_feedback

knowledge_documents
   -> knowledge_chunks

users admin
   -> admin_activity_logs
```

## Workflow Keamanan dan Guardrail

Yang sudah diterapkan:

- session auth Laravel
- verified email untuk area chat dan admin
- role guard admin/user
- ownership check conversation dan message
- throttle login dan chat
- validasi input chat maksimal 4000 karakter
- validasi pesan kosong
- moderation sebelum pesan dikirim ke AI
- idempotency key untuk mencegah request dobel
- fallback jika provider AI gagal
- AI diarahkan menjawab knowledge Deka hanya dari context yang ditemukan

## Workflow Testing

Test yang tersedia mencakup:

- auth
- email verification
- password reset
- two-factor challenge
- dashboard/admin backend
- chat API
- knowledge RAG
- user role
- AI runtime client
- email normalization
- knowledge query normalizer

Command umum:

```bash
php artisan test
npm run lint
npm run types
```

## Ringkasan Status

Backend yang sudah dikerjakan:

- auth API session-based
- Google OAuth
- email verification
- two-factor auth support
- role admin/user
- CRUD user admin
- CRUD role admin
- conversation dan message persistence
- chat JSON dan streaming SSE
- moderation
- idempotency
- AI runtime
- fallback provider
- feedback like/dislike
- feedback review admin
- AI improvement untuk feedback
- token usage analytics
- activity log admin
- knowledge ingestion file
- knowledge crawl website
- chunking
- embedding service
- retrieval knowledge
- source metadata pada assistant message

Frontend yang sudah dikerjakan:

- halaman welcome
- halaman auth
- halaman chat user
- sidebar history conversation
- streaming answer UI
- feedback like/dislike dengan reason
- settings modal
- logout confirmation
- dashboard admin
- chart conversation
- chart feedback
- chart token usage
- section token usage
- section feedback review
- section user management
- section role management
- section activity log
- section knowledge monitoring
- section runtime/moderation/auth information

