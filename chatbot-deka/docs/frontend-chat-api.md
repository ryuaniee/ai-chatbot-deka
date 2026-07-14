# Frontend Chat API

Dokumen ini adalah kontrak API backend yang dipakai frontend untuk halaman `/chat`.

Semua endpoint di bawah memakai **session auth** Laravel, bukan bearer token.

## Base

- app web: `http://127.0.0.1:8000`
- chat page: `GET /chat`
- semua request API kirim:
  - `Accept: application/json`
  - `Content-Type: application/json`

## Prasyarat Auth

Frontend flow minimal:

1. login atau register user biasa
2. user harus verified email
3. ambil user aktif lewat `GET /api/auth/me`
4. kalau `redirect_to=/chat`, frontend boleh masuk halaman chat

Auth endpoint yang relevan:

### `GET /api/auth/csrf`

Response:

```json
{
  "csrf_token": "token",
  "authenticated": false
}
```

### `GET /api/auth/me`

Response:

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

## Chat Endpoints

### `GET /api/conversations`

Ambil daftar percakapan milik user, urut terbaru.

Response:

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

Request body tanpa pesan pertama:

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

Request body dengan pesan pertama:

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

Response:

```json
{
  "data": {
    "id": 5,
    "title": "Sapaan awal",
    "status": "active",
    "last_message_at": "2026-07-13T15:12:00Z",
    "created_at": "2026-07-13T15:12:00Z",
    "updated_at": "2026-07-13T15:12:00Z",
    "messages": [
      {
        "id": 10,
        "conversation_id": 5,
        "reply_to_message_id": null,
        "role": "user",
        "content": "Halo, Deka itu apa?",
        "sequence": 1,
        "created_at": "2026-07-13T15:12:00Z"
      },
      {
        "id": 11,
        "conversation_id": 5,
        "reply_to_message_id": 10,
        "role": "assistant",
        "content": "Deka adalah ...",
        "sequence": 2,
        "created_at": "2026-07-13T15:12:02Z"
      }
    ]
  }
}
```

### `POST /api/conversations/{conversation}/messages`

Kirim pesan baru ke percakapan yang sudah ada.

Request:

```json
{
  "content": "Lanjutkan penjelasannya"
}
```

Response:

```json
{
  "conversation": {
    "id": 5,
    "title": "Sapaan awal",
    "status": "active",
    "last_message_at": "2026-07-13T15:14:00Z",
    "created_at": "2026-07-13T15:12:00Z",
    "updated_at": "2026-07-13T15:14:00Z"
  },
  "user_message": {
    "id": 12,
    "conversation_id": 5,
    "reply_to_message_id": null,
    "role": "user",
    "content": "Lanjutkan penjelasannya",
    "sequence": 3,
    "created_at": "2026-07-13T15:14:00Z"
  },
  "assistant_message": {
    "id": 13,
    "conversation_id": 5,
    "reply_to_message_id": 12,
    "role": "assistant",
    "content": "Baik, berikut lanjutannya ...",
    "sequence": 4,
    "created_at": "2026-07-13T15:14:02Z"
  }
}
```

## Error Contract

### `401`

Session tidak valid atau user belum login.

### `403`

Kasus umum:

- user belum verified email
- admin mencoba akses chat user

Contoh:

```json
{
  "message": "This action is unauthorized."
}
```

Atau:

```json
{
  "message": "Admin cannot access the user chat area.",
  "code": "ADMIN_ACCESS_DENIED"
}
```

### `404`

Conversation bukan milik user.

### `409`

Idempotency key dipakai ulang untuk request berbeda.

```json
{
  "message": "Idempotency key has already been used.",
  "code": "IDEMPOTENCY_KEY_REUSED"
}
```

### `422`

Moderation block atau validasi gagal.

Contoh moderation:

```json
{
  "message": "Message blocked by safety policy.",
  "code": "SELF_HARM_INSTRUCTIONS"
}
```

### `429`

Rate limit chat kena.

Frontend sebaiknya tampilkan pesan:

- `Terlalu banyak request. Coba lagi sebentar.`

### `502`

AI service gagal generate jawaban.

```json
{
  "message": "Assistant response could not be generated.",
  "code": "AI_SERVICE_UNAVAILABLE"
}
```

### `503`

AI service salah konfigurasi atau sementara tidak tersedia.

```json
{
  "message": "Assistant service is temporarily unavailable.",
  "code": "AI_SERVICE_MISCONFIGURED"
}
```

## Flow Frontend yang Direkomendasikan

Untuk halaman `/chat`, frontend cukup pakai flow ini:

1. saat halaman dibuka, panggil `GET /api/conversations`
2. saat user pilih item sidebar, panggil `GET /api/conversations/{id}`
3. saat user mulai chat baru dari halaman kosong:
   - panggil `POST /api/conversations` dengan `content`
   - render `user_message`
   - render `assistant_message`
   - simpan `conversation.id` jadi active conversation
4. saat user kirim pesan ke conversation aktif:
   - panggil `POST /api/conversations/{id}/messages`
   - append `user_message`
   - append `assistant_message`
5. setelah berhasil kirim pesan, refresh daftar conversation dengan `GET /api/conversations`

## Catatan Implementasi Frontend

- `role` message hanya `user` atau `assistant`
- gunakan `sequence` untuk urutan render message
- gunakan `reply_to_message_id` bila nanti ingin thread relation
- jangan izinkan admin memakai halaman `/chat`
- jangan tampilkan chat untuk user yang belum verified
- bila `assistant_message` gagal, frontend tetap harus siap menghadapi pesan user yang sudah tersimpan di backend
