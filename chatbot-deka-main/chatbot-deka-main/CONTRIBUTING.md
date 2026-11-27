# Contributing

Terima kasih sudah membantu Chatbot Deka. Ikuti alur ini agar perubahan mudah direview dan aman masuk ke `main`.

## Branch

Gunakan branch kecil dan jelas:

- `feat/nama-fitur`
- `fix/nama-bug`
- `chore/nama-maintenance`
- `docs/nama-dokumen`

## Setup

```bash
cp .env.example .env
docker compose up -d
composer install
npm install
php artisan key:generate
php artisan migrate
php artisan db:seed --class=AdminUserSeeder
npm run build
```

## Quality Gate

Sebelum membuka PR, jalankan:

```bash
composer test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

Untuk perubahan UI/admin flow, jalankan smoke test:

```bash
php artisan serve --host=127.0.0.1 --port=8000
BASE_URL=http://127.0.0.1:8000 npm run test:e2e
```

## Pull Request

- Link issue terkait dengan `Closes #...` jika ada.
- Jelaskan perubahan, alasan, dan cara verifikasi.
- Screenshot hanya perlu untuk perubahan visual.
- Jangan commit `.env`, credential, dump database, atau file build/cache lokal.

## Dokumentasi

Update `README.md` atau `docs/` jika perubahan memengaruhi setup, environment, endpoint, role access, testing, atau workflow deploy.
