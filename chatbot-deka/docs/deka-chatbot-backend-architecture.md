# Arsitektur Backend Final

Dokumen ini mendefinisikan arsitektur backend final untuk chatbot informasi Deka.

Target produk:

- chatbot dipakai pengguna untuk bertanya, "Deka itu apa?"
- jawaban harus bersumber dari data resmi Deka
- sistem tidak boleh bertindak sebagai assistant umum yang menjawab bebas
- jika data tidak ditemukan, chatbot harus jujur mengatakan informasi belum tersedia
- sistem hanya memakai dua role: `admin` dan `user`

## 1. Tujuan Sistem

Backend chatbot ini dibangun untuk tiga fungsi utama:

1. menerima pertanyaan user
2. mencari konteks paling relevan dari knowledge resmi Deka
3. menghasilkan jawaban singkat, akurat, dan terbatas pada konteks tersebut

Prinsip desain:

- source of truth utama adalah `deka.dev`
- retrieval lebih penting daripada kreativitas model
- backend mengontrol workflow, bukan model
- model hanya bertugas menyusun jawaban dari context yang diberikan

## 2. Batasan Produk

Chatbot ini bukan:

- AI assistant serbaguna
- agen yang browsing internet bebas
- bot yang boleh berimprovisasi tanpa sumber
- sistem yang menyimpan semua knowledge langsung di prompt statis

Chatbot ini adalah:

- knowledge chatbot
- domain-specific RAG backend
- backend yang menghubungkan crawl, storage, retrieval, dan generation

## 3. Gambaran Arsitektur

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
[documents table]     [document_chunks + embeddings]
   |                        |
   +-----------+------------+
               |
               v
      [Retrieval Service / API]
               |
               v
 [Laravel Auth + Role + Chat Workflow]
               |
         +-----+------+
         |            |
         v            v
 [Admin Panel]   [AI Service]
         |            |
         +-----+------+
               |
               v
      [OpenAI-compatible Router]
               |
               v
            Response
```

## 4. Komponen Inti

### 4.1 Laravel App

Peran:

- menerima request chat dari user
- menyimpan conversation dan message
- memanggil moderation
- memanggil retrieval service
- menyusun payload final ke `ai-service`
- menyimpan jawaban assistant

Yang tetap berada di Laravel:

- auth API
- role management dasar
- admin panel
- auth
- rate limit
- idempotency
- audit trail conversation
- persistence message
- workflow orchestration

Laravel tidak bertugas:

- crawling website
- membuat embedding
- melakukan similarity search langsung ke model provider

### 4.1.1 Role dan Akses

Role yang dipakai hanya dua:

- `admin`
- `user`

Aturan akses:

- `user` memakai aplikasi chat biasa
- `admin` bisa masuk admin panel untuk monitoring dan pengelolaan
- tidak ada role lain di arsitektur awal ini

Pendekatan ini sengaja sederhana supaya:

- auth tidak bercabang terlalu cepat
- panel admin tetap memakai model user yang sama
- RBAC bisa berkembang nanti tanpa membongkar fondasi

### 4.2 AI Service

Peran:

- menerima pertanyaan user dan context hasil retrieval
- menjalankan prompt policy
- memanggil model
- mengembalikan jawaban terstruktur

AI service sebaiknya tetap tipis.

Tanggung jawabnya:

- validasi request
- enforce prompt policy
- fallback model
- normalisasi response model

AI service tidak sebaiknya menjadi tempat:

- crawl logic
- indexing logic
- source management
- business rule yang kompleks

### 4.3 Ingestion Worker

Peran:

- crawl halaman dari `deka.dev`
- ekstrak teks utama
- bersihkan noise
- buat chunk
- hitung embedding
- simpan dokumen dan chunk

Worker ini lebih baik dijalankan sebagai proses terpisah, misalnya:

- Laravel command terjadwal
- Python worker terpisah
- queue worker khusus ingestion

Untuk use case ini, worker terpisah lebih aman daripada menempelkan ingestion ke request runtime.

### 4.4 Retrieval Service

Peran:

- menerima query dari Laravel
- melakukan similarity search ke chunk
- mengembalikan top-k context yang paling relevan
- menerapkan threshold agar context lemah tidak ikut dipakai

Retrieval bisa berada:

- di Laravel service layer, jika query vector store sederhana
- atau di service terpisah, jika nantinya ranking dan filtering makin kompleks

Untuk tahap awal, retrieval service internal di Laravel sudah cukup.

### 4.5 Admin Panel

Admin panel berada di sisi Laravel dan dipakai untuk:

- melihat data user
- melihat conversation
- memantau data chatbot
- menjadi titik awal operasional internal

Admin panel tidak dipakai user biasa.

Prinsipnya:

- satu tabel `users`
- satu sistem auth
- pembeda akses hanya di field `role`

## 5. Alur Data Final

### 5.1 Ingestion Flow

```text
Scheduler
   -> crawl daftar halaman deka.dev
   -> fetch HTML
   -> parse konten utama
   -> normalize teks
   -> split menjadi chunk
   -> generate embedding per chunk
   -> simpan dokumen
   -> simpan chunk + vector + metadata
   -> tandai versi ingest
```

### 5.2 Runtime Chat Flow

```text
User question
   -> Laravel validates request
   -> Laravel moderates content
   -> Laravel persists user message
   -> Laravel queries retrieval
   -> Retrieval returns top chunks
   -> Laravel builds chat payload with context
   -> AI service enforces answer policy
   -> Model generates answer
   -> Laravel stores assistant message
   -> API returns response
```

### 5.3 No-Answer Flow

```text
User question
   -> retrieval result below threshold
   -> AI service receives empty/weak context
   -> assistant answers:
      "Saya belum menemukan informasi itu di knowledge Deka saat ini."
```

Ini penting untuk mencegah halusinasi.

## 6. Desain Penyimpanan Data

### 6.1 Tabel `documents`

Tujuan:

- menyimpan identitas dokumen sumber
- mempermudah re-crawl, dedup, dan audit

Struktur minimum:

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | bigint | primary key |
| `source_url` | string unique | URL asli halaman |
| `canonical_url` | string nullable | URL canonical jika ada |
| `title` | string | judul halaman |
| `content_hash` | string | hash konten untuk deteksi perubahan |
| `language` | string nullable | mis. `id` |
| `status` | string | `active`, `stale`, `deleted`, `failed` |
| `last_crawled_at` | timestamp nullable | waktu crawl terakhir |
| `published_at` | timestamp nullable | jika tersedia |
| `metadata` | jsonb | breadcrumb, tags, section |
| `created_at` | timestamp | audit |
| `updated_at` | timestamp | audit |

### 6.2 Tabel `document_chunks`

Tujuan:

- menyimpan unit pencarian semantik
- menjadi basis retrieval

Struktur minimum:

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | bigint | primary key |
| `document_id` | foreign key | relasi ke `documents` |
| `chunk_index` | integer | urutan chunk |
| `content` | text | isi chunk |
| `content_hash` | string | hash chunk |
| `token_count` | integer | estimasi ukuran |
| `embedding_model` | string | model embedding |
| `embedding` | vector / jsonb | tergantung storage |
| `metadata` | jsonb | heading, section, anchors |
| `created_at` | timestamp | audit |
| `updated_at` | timestamp | audit |

Constraint penting:

- unique `(document_id, chunk_index)`
- index pada `document_id`
- index vector sesuai storage yang dipakai

### 6.3 Tabel `ingestion_runs`

Tujuan:

- memudahkan observability ingest
- tahu kapan crawl gagal atau partial

Struktur minimum:

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | bigint | primary key |
| `started_at` | timestamp | mulai ingest |
| `finished_at` | timestamp nullable | selesai ingest |
| `status` | string | `running`, `success`, `failed` |
| `pages_seen` | integer | total URL yang diproses |
| `pages_changed` | integer | URL yang berubah |
| `pages_failed` | integer | URL gagal |
| `notes` | text nullable | error ringkas |

## 7. Pilihan Storage Vector

Untuk stack Anda saat ini, pilihan paling pas:

### Opsi A: PostgreSQL + pgvector

Cocok jika:

- ingin tetap sederhana
- semua data ingin dekat dengan app Laravel
- skala masih menengah

Kelebihan:

- satu database
- operasional lebih sederhana
- query metadata dan vector bisa dekat

Kekurangan:

- tuning retrieval lebih terbatas dibanding engine khusus

### Opsi B: Database biasa + vector store terpisah

Contoh:

- PostgreSQL untuk metadata
- Qdrant/Weaviate untuk vector

Cocok jika:

- dokumen makin besar
- retrieval makin kompleks
- butuh filter dan ranking lebih kaya

Rekomendasi tahap awal:

- gunakan `PostgreSQL + pgvector`

Itu paling pas untuk menjaga kompleksitas tetap rendah.

## 8. Strategi Crawl dan Ingestion

### 8.1 Ruang Lingkup Crawl

Batasi hanya ke domain resmi:

- `https://deka.dev/`
- subpath yang relevan

Jangan crawl:

- asset statis
- halaman admin
- URL duplikat dengan query tak penting
- halaman tipis atau kosong

### 8.2 Langkah Parsing

Urutan parsing yang dianjurkan:

1. ambil HTML
2. hapus script, style, nav, footer berulang
3. ekstrak title dan heading
4. ekstrak konten utama
5. normalisasi whitespace
6. simpan canonical URL
7. hitung hash konten

### 8.3 Strategi Chunking

Gunakan chunk berbasis section, bukan potong karakter buta.

Prioritas:

1. pecah berdasarkan heading
2. gabungkan paragraf yang masih satu konteks
3. jaga ukuran chunk stabil

Target awal:

- 300 sampai 800 token per chunk
- overlap kecil jika perlu
- jangan potong satu paragraf penting menjadi serpihan acak

### 8.4 Re-ingestion

Saat crawl ulang:

- bandingkan `content_hash`
- jika tidak berubah, skip re-embedding
- jika berubah, ganti seluruh chunk dokumen tersebut
- tandai dokumen lama sebagai stale jika URL hilang

## 9. Retrieval Strategy

### 9.1 Query Pipeline

Saat user bertanya:

1. normalisasi query
2. generate embedding query
3. cari top-k chunk terdekat
4. filter berdasarkan similarity threshold
5. gabungkan chunk terbaik
6. kirim ke AI service sebagai context

### 9.2 Ranking Awal

Versi awal yang cukup:

- vector similarity
- boost kecil untuk halaman yang judulnya sangat cocok
- dedup chunk dari dokumen yang sama jika terlalu berulang

### 9.3 Threshold

Threshold wajib ada.

Tanpa threshold, model akan tetap dipaksa menjawab walau konteks lemah.

Aturan yang disarankan:

- jika tidak ada chunk yang lolos threshold, jangan buat jawaban faktual
- balas dengan pesan aman bahwa informasi belum tersedia di knowledge Deka

## 10. Contract Antar Service

### 10.1 Request dari Laravel ke Retrieval Layer

```json
{
  "query": "Deka itu apa?",
  "top_k": 5,
  "min_score": 0.75
}
```

### 10.2 Response Retrieval

```json
{
  "results": [
    {
      "document_id": 10,
      "source_url": "https://deka.dev/about",
      "title": "Tentang Deka",
      "content": "Deka adalah ...",
      "score": 0.91,
      "metadata": {
        "heading": "Tentang Kami"
      }
    }
  ]
}
```

### 10.3 Request dari Laravel ke AI Service

```json
{
  "conversation_id": 123,
  "user_id": 22,
  "question": "Deka itu apa?",
  "context": [
    {
      "source_url": "https://deka.dev/about",
      "title": "Tentang Deka",
      "content": "Deka adalah ..."
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "Deka itu apa?"
    }
  ]
}
```

Catatan:

- `context` harus eksplisit
- jangan mengandalkan model untuk "mengingat" knowledge
- `messages` tetap dipakai untuk alur percakapan

## 11. Prompt Policy dan Batas Tanggung Jawab

Bagian ini gabungan backend dan prompt policy.

### Yang ditanggung backend

- hanya kirim context dari knowledge Deka
- kirim source URL
- blok jawaban jika retrieval lemah
- enforce fallback "informasi tidak ditemukan"
- batasi scope ke knowledge resmi

### Yang ditanggung prompt policy

- instruksi agar model menjawab hanya dari context
- instruksi agar model tidak mengarang
- format jawaban singkat dan informatif
- instruksi untuk mengaku tidak tahu jika context kosong

Kesimpulan:

- guardrail utama harus di backend
- prompt hanya memperkuat kebijakan

## 12. Perubahan yang Dibutuhkan pada AI Service

`ai-service` perlu berubah dari generic responder menjadi contextual responder.

Perubahan utama:

1. schema request menerima `question` dan `context`
2. prompt system menjelaskan bahwa jawaban wajib berbasis context
3. jika `context` kosong, hasilkan jawaban fallback aman
4. jika `context` ada, model hanya merangkum dan menyusun ulang
5. response idealnya memuat `sources`

Contoh perilaku yang benar:

- jika context mendukung, jawab singkat
- jika context lemah, bilang informasi belum tersedia
- jangan menjawab di luar source yang diberikan

## 13. Perubahan yang Dibutuhkan pada Laravel Workflow

Service chat di Laravel nantinya harus:

1. simpan user question
2. panggil moderation
3. panggil retrieval
4. evaluasi apakah context cukup kuat
5. kirim `question + context + chat history terbatas` ke AI service
6. simpan jawaban dan sumber

Selain itu, Laravel juga harus mempertahankan:

- auth API user
- role `admin` dan `user`
- admin panel yang terpisah dari flow user biasa

Tambahan yang disarankan:

- simpan retrieval snapshot pada metadata assistant message
- simpan source URL yang dipakai
- simpan score tertinggi retrieval untuk audit

## 14. Observability yang Wajib Ada

### Untuk ingestion

- jumlah halaman di-crawl
- jumlah halaman berubah
- jumlah embedding sukses/gagal
- waktu ingest

### Untuk retrieval

- query count
- top score
- top-k result count
- no-hit rate

### Untuk generation

- model yang dipakai
- fallback model usage
- latency
- failure rate
- token usage

### Untuk product quality

- pertanyaan yang sering gagal dijawab
- halaman knowledge yang paling sering dipakai
- pertanyaan yang menyebabkan no-hit

## 15. Risiko Production yang Perlu Dikendalikan

### Risiko 1: Hallucination

Mitigasi:

- threshold retrieval
- prompt berbasis context
- fallback no-answer

### Risiko 2: Knowledge basi

Mitigasi:

- scheduler re-crawl
- hash-based update
- observability ingestion

### Risiko 3: Jawaban salah karena chunk buruk

Mitigasi:

- chunk by heading
- simpan metadata section
- evaluasi hasil retrieval

### Risiko 4: Latency tinggi

Mitigasi:

- batasi top-k
- batasi panjang context
- cache retrieval untuk query populer

### Risiko 5: Dependensi model eksternal

Mitigasi:

- fallback model
- timeout
- logging model attempts

## 16. Urutan Implementasi yang Paling Aman

Urutan kerja backend yang paling masuk akal:

1. tambahkan schema `documents`, `document_chunks`, `ingestion_runs`
2. aktifkan `pgvector` atau putuskan storage vector final
3. buat crawler untuk `deka.dev`
4. buat pipeline cleaner + chunker
5. buat embedding pipeline
6. simpan hasil ingest ke database
7. buat retrieval service internal
8. ubah `ai-service` agar menerima `context`
9. ubah Laravel chat workflow agar memanggil retrieval sebelum generation
10. tambahkan source citation dan metadata audit
11. tambahkan evaluasi no-hit dan kualitas retrieval

Urutan ini penting karena:

- retrieval tidak mungkin bagus tanpa chunk yang benar
- prompt tidak akan menyelamatkan knowledge pipeline yang buruk
- generation harus berada paling akhir, bukan paling awal

## 17. Rekomendasi Final

Untuk use case chatbot informasi Deka, arsitektur backend paling pas adalah:

- Laravel sebagai orchestrator auth, role, admin panel, dan workflow chat
- AI service tipis untuk generation dan guardrail prompt
- ingestion worker terpisah untuk crawl dan embedding
- PostgreSQL + pgvector sebagai storage awal
- retrieval berbasis chunk dari `deka.dev`
- model hanya menjawab dari context resmi

Kalimat sederhananya:

> Bangun chatbot ini sebagai sistem retrieval-first, bukan model-first.

Itu keputusan arsitektur paling benar untuk chatbot informasi perusahaan.
