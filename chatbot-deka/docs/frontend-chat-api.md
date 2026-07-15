# Frontend Chat API

Dokumen ini adalah kontrak backend untuk halaman `/chat`.

Semua endpoint di bawah memakai session auth Laravel, bukan bearer token.

## Base

- app web: `http://127.0.0.1:8000`
- chat page: `GET /chat`

Untuk request JSON biasa, kirim:

- `Accept: application/json`
- `Content-Type: application/json`

Untuk stream SSE, kirim:

- `Accept: text/event-stream`
- `Content-Type: application/json`

## Prasyarat Auth

Flow minimal frontend:

1. login atau register user biasa
2. user harus verified email
3. ambil user aktif lewat `GET /api/auth/me`
4. kalau `redirect_to=/chat`, user boleh masuk halaman chat

Endpoint auth yang relevan:

- `GET /api/auth/csrf`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Contoh `GET /api/auth/me`:

```json
{
  "user": {
    "id": 22,
    "name": "Kepin",
    "email": "kepin@example.com",
    "role": "user",
    "email_verified_at": "2026-07-13T15:00:00Z",
    "requires_email_verification": false,
    "has_two_factor": false
  },
  "redirect_to": "/chat"
}
```

## Resource Chat

### `GET /api/conversations`

Ambil daftar percakapan milik user, urut terbaru.

```json
{
  "data": [
    {
      "id": 3,
      "title": "Sapaan awal",
      "status": "active",
      "last_message_at": "2026-07-13T15:10:00Z",
      "created_at": "2026-07-13T15:09:00Z",
      "updated_at": "2026-07-13T15:10:00Z"
    }
  ]
}
```

### `POST /api/conversations`

Buat percakapan baru.

Tanpa pesan pertama:

```json
{}
```

Response:

```json
{
  "data": {
    "id": 4,
    "title": null,
    "status": "active",
    "last_message_at": null,
    "created_at": "2026-07-13T15:11:00Z",
    "updated_at": "2026-07-13T15:11:00Z"
  }
}
```

Dengan pesan pertama:

```json
{
  "content": "Halo, Deka itu apa?"
}
```

Response:

```json
{
  "conversation": {
    "id": 5,
    "title": "Sapaan awal",
    "status": "active",
    "last_message_at": "2026-07-13T15:12:00Z",
    "created_at": "2026-07-13T15:12:00Z",
    "updated_at": "2026-07-13T15:12:00Z"
  },
  "user_message": {
    "id": 10,
    "conversation_id": 5,
    "reply_to_message_id": null,
    "role": "user",
    "content": "Halo, Deka itu apa?",
    "sequence": 1,
    "created_at": "2026-07-13T15:12:00Z"
  },
  "assistant_message": {
    "id": 11,
    "conversation_id": 5,
    "reply_to_message_id": 10,
    "role": "assistant",
    "content": "Deka adalah ...",
    "sequence": 2,
    "created_at": "2026-07-13T15:12:02Z"
  }
}
```

### `GET /api/conversations/{conversation}`

Ambil detail satu percakapan beserta semua message.

### `POST /api/conversations/{conversation}/messages`

Kirim pesan baru ke percakapan yang sudah ada.

```json
{
  "content": "Lanjutkan penjelasannya"
}
```

Response sukses sama seperti `POST /api/conversations`, yaitu mengembalikan:

- `conversation`
- `user_message`
- `assistant_message`

## Streaming SSE

Frontend chat di repo ini memakai SSE untuk kirim pesan.

### `POST /api/conversations/stream`

Membuat conversation baru dan langsung stream balasan assistant.

Request:

```json
{
  "content": "Halo bot"
}
```

### `POST /api/conversations/{conversation}/messages/stream`

Mengirim pesan ke conversation yang sudah ada dan stream balasan assistant.

Request:

```json
{
  "content": "Lanjutkan"
}
```

### Event SSE

Response bertipe `text/event-stream`.

Urutan event yang diharapkan:

1. `conversation_started`
2. satu atau lebih `text_delta`
3. `message_complete`
4. `data: [DONE]`

Contoh stream:

```text
data: {"type":"conversation_started","conversation":{"id":14},"user_message":{"id":20}}

data: {"type":"text_delta","delta":"Halo"}

data: {"type":"text_delta","delta":" stream."}

data: {"type":"message_complete","conversation":{"id":14},"assistant_message":{"id":21,"content":"Halo stream."}}

data: [DONE]
```

Payload event:

### `conversation_started`

```json
{
  "type": "conversation_started",
  "conversation": {
    "id": 14
  },
  "user_message": {
    "id": 20
  }
}
```

### `text_delta`

```json
{
  "type": "text_delta",
  "delta": "Halo"
}
```

### `message_complete`

```json
{
  "type": "message_complete",
  "conversation": {
    "id": 14
  },
  "assistant_message": {
    "id": 21,
    "content": "Halo stream."
  }
}
```

### `error`

Kalau stream gagal saat generation berlangsung:

```json
{
  "type": "error",
  "message": "Assistant stream failed."
}
```

## Idempotency

Untuk endpoint `POST`, frontend boleh mengirim header:

```text
Idempotency-Key: <uuid-or-client-generated-key>
```

Jika key dipakai ulang untuk payload berbeda, backend akan mengembalikan `409`.

## Error Contract

### `401`

Session tidak valid atau user belum login.

### `403`

Kasus umum:

- user belum verified email
- admin mencoba akses chat user

### `404`

Conversation bukan milik user.

### `409`

Idempotency key dipakai ulang untuk payload berbeda.

```json
{
  "message": "Idempotency-Key has already been used with a different payload.",
  "code": "IDEMPOTENCY_KEY_REUSED"
}
```

### `422`

Validasi gagal atau moderation block.

Contoh moderation:

```json
{
  "message": "Message blocked by safety policy.",
  "code": "SELF_HARM_INSTRUCTIONS"
}
```

### `429`

Rate limit chat kena.

### `502`

Runtime AI gagal generate jawaban.

```json
{
  "message": "Assistant response could not be generated.",
  "code": "AI_RUNTIME_UNAVAILABLE"
}
```

### `503`

Runtime AI salah konfigurasi atau sementara tidak tersedia.

```json
{
  "message": "Assistant runtime is temporarily unavailable.",
  "code": "AI_RUNTIME_MISCONFIGURED"
}
```

## Flow Frontend yang Direkomendasikan

1. pastikan user login dan verified
2. ambil daftar conversation via `GET /api/conversations`
3. untuk open conversation, pakai `GET /api/conversations/{conversation}`
4. untuk kirim pesan dari UI utama, pakai endpoint stream
5. treat `conversation_started` sebagai pengganti optimistic user message
6. gabungkan semua `text_delta` sampai `message_complete`
7. anggap stream selesai saat menerima `data: [DONE]`
