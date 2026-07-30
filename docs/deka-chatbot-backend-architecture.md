# Arsitektur Backend

Dokumen ini mendefinisikan arsitektur backend target untuk chatbot informasi Deka.

## Tujuan

Target akhir produk:

- user bertanya tentang Deka
- jawaban bersumber dari data resmi Deka
- sistem jujur jika context tidak tersedia
- backend tetap mengontrol workflow, bukan model

## Status Saat Ini

Yang sudah ada di repo:

- Laravel app tunggal
- auth API session-based
- role `admin` dan `user`
- persistence conversation dan message
- runtime AI langsung di Laravel via `laravel/ai`
- moderation, idempotency, rate limit
- endpoint chat JSON dan stream SSE
- retrieval knowledge Deka berbasis PostgreSQL full-text search, embedding/vector similarity, mode hybrid, query rewrite, AI selector/reranker
- ingestion file dan website dengan chunking, content hash, versi dokumen, probe validasi, dan fallback full-text jika embedding gagal
- dashboard admin untuk overview, token usage, feedback review, users, roles, activity log, dan status knowledge

Yang belum ada:

- admin UI untuk edit knowledge manual
- workflow approval knowledge manual oleh admin non-teknis
- monitoring production eksternal seperti APM, alerting, backup verification, dan audit deploy

## Gambaran Arsitektur Target

```text
deka.dev
   |
   v
[Crawler / Ingestion Worker]
   |
   v
[Cleaner + Chunker + Metadata Extractor]
   |
   +------------------------+
   |                        |
   v                        v
[knowledge_documents] [knowledge_chunks]
   |                        |
   +-----------+------------+
               |
               v
         [Retrieval Layer]
               |
               v
 [Laravel Auth + Chat Workflow + Admin]
               |
               v
   [Laravel AI SDK / Provider Matrix]
               |
               v
            Response
```

## Komponen Inti

### Laravel App

Laravel tetap menjadi orchestration layer utama.

Tanggung jawabnya:

- menerima request user
- memvalidasi input
- moderasi pesan
- menyimpan conversation dan message
- membangun context untuk model
- memanggil `laravel/ai`
- menyimpan assistant reply
- melayani stream SSE ke frontend

Laravel tidak perlu menjadi:

- crawler
- vector engine

Catatan: crawler/ingestion command saat ini masih berada di aplikasi Laravel untuk operasional awal. Jika volume data membesar, proses crawl dan embedding sebaiknya dipindah ke worker/queue terpisah.

### Runtime AI

Runtime AI sekarang berada langsung di Laravel.

Komponen utamanya:

- `AiRuntimeClient`
- agent reply
- agent moderation
- agent title
- provider matrix untuk primary dan fallback model

Tanggung jawab runtime:

- memilih provider/model
- memetakan error upstream ke error lokal
- menjalankan stream dan non-stream
- menjaga prompt policy tetap tipis dan terkontrol

### Retrieval Layer

Retrieval sudah berjalan di service Laravel.

Kemampuan saat ini:

- menerima pertanyaan user
- menormalisasi typo dan variasi pertanyaan
- menulis beberapa query pencarian per intent
- mencari chunk relevan lewat PostgreSQL full-text, vector similarity, atau hybrid
- menggabungkan ranking full-text/vector
- menerapkan threshold agar context lemah tidak ikut dipakai
- memakai AI selector/reranker untuk memilih kandidat yang paling mendukung jawaban

Jika retrieval tidak menemukan konteks kuat, assistant diarahkan untuk menjawab bahwa informasi belum tersedia pada data Deka yang dimiliki.

### Ingestion

Ingestion saat ini tersedia lewat command Laravel.

- ingest file teks/PDF dan crawl halaman website
- ekstrak teks utama
- bersihkan noise
- split jadi chunk
- generate embedding bila mode retrieval membutuhkan vector/hybrid
- simpan dokumen, versi, chunk, embedding/full-text fallback, dan ingestion run
- validasi versi baru sebelum menggantikan versi aktif jika validation enabled

Untuk production dengan volume besar, ingestion sebaiknya dijalankan sebagai queue/worker terpisah dari request chat.

## Alur Data Saat Ini

### Chat Runtime

```text
User question
   -> Laravel validates request
   -> Laravel moderates content
   -> Laravel persists user message
   -> Laravel builds bounded conversation context
   -> Laravel AI runtime runs reply agent
   -> Laravel stores assistant message
   -> API returns JSON or SSE stream
```

### Stream Runtime

```text
User question
   -> Laravel validates request
   -> Laravel persists user message
   -> Laravel starts AI stream
   -> frontend receives conversation_started
   -> frontend receives text_delta chunks
   -> Laravel persists final assistant message
   -> frontend receives message_complete
   -> stream ends with [DONE]
```

### No-Answer Flow Target

Setelah retrieval knowledge versi baru ada:

```text
User question
   -> retrieval result below threshold
   -> runtime gets weak / empty context
   -> assistant says information is not available in Deka knowledge yet
```

## Desain Penyimpanan Knowledge Target

### `documents`

Tujuan:

- menyimpan sumber halaman
- mendukung audit dan recrawl

Kolom minimum:

- `id`
- `source_url`
- `canonical_url`
- `title`
- `content_hash`
- `language`
- `status`
- `last_crawled_at`
- `published_at`
- `metadata`
- `created_at`
- `updated_at`

### `document_chunks`

Tujuan:

- menyimpan unit retrieval semantik

Kolom minimum:

- `id`
- `document_id`
- `chunk_index`
- `content`
- `content_hash`
- `token_count`
- `embedding_model`
- `embedding`
- `metadata`
- `created_at`
- `updated_at`

### `ingestion_runs`

Tujuan:

- observability proses ingest

Kolom minimum:

- `id`
- `started_at`
- `finished_at`
- `status`
- `pages_seen`
- `pages_changed`
- `pages_failed`
- `notes`

## Pilihan Vector Store

Opsi paling masuk akal untuk stack sekarang:

### Opsi A: PostgreSQL + `pgvector`

Kelebihan:

- satu database
- operasional sederhana
- cocok untuk tahap awal

Kekurangan:

- tuning retrieval lebih terbatas

### Opsi B: PostgreSQL + vector store terpisah

Contoh:

- PostgreSQL untuk metadata
- Qdrant/Weaviate untuk vector

Cocok jika kebutuhan ranking dan observability retrieval nanti makin kompleks.

## Role dan Akses

Role yang dipakai tetap sederhana:

- `admin`
- `user`

Aturan:

- `user` memakai aplikasi chat
- `admin` tidak memakai halaman chat user; `/admin` saat ini ditutup
- satu tabel `users`
- tidak ada tabel admin terpisah

## Prinsip Desain

- backend mengontrol workflow
- model tidak menjadi source of truth
- history chat dibatasi agar stabil
- moderation dijalankan sebelum generation
- retry aman lewat idempotency
- stream dan non-stream harus menghasilkan persistence akhir yang sama

## Arah Lanjut

Urutan kerja yang paling masuk akal sesudah fondasi sekarang:

1. finalkan kebutuhan knowledge Deka dan sumber datanya
2. desain schema `documents`, `document_chunks`, dan `ingestion_runs`
3. tentukan retrieval awal: full-text PostgreSQL, `pgvector`, atau hybrid
4. implement ingestion worker baru
5. implement retrieval dan threshold
6. inject context retrieval ke runtime AI
7. ubah prompt policy agar hanya menjawab dari context Deka yang tersedia
