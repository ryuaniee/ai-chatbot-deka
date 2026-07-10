# Chatbot Deka

Setup awal project chatbot Deka dengan stack:

- Laravel + Inertia React + shadcn/ui di `app/`
- PostgreSQL via Docker Compose
- FastAPI + LangChain Python di `ai-service/`

Belum ada fitur frontend custom. Isi React yang ada hanya bawaan Laravel React starter kit.

## Prasyarat

- PHP 8.3+
- Composer
- Node.js + npm
- Python 3.12+
- uv
- Docker
- Ekstensi PHP `pdo_pgsql`

## Database

```bash
cd chatbot-deka
docker compose up -d postgres
```

Konfigurasi default:

- Host: `127.0.0.1`
- Port: `5433`
- Database: `chatbot_deka`
- Username: `chatbot_deka`
- Password: `secret`

## Laravel App

```bash
cd chatbot-deka/app
cp .env.example .env
php artisan key:generate
composer install
npm install
php artisan migrate
composer run dev
```

`composer run dev` menjalankan Laravel server, queue listener, log watcher, dan Vite.

## AI Service

```bash
cd chatbot-deka/ai-service
cp .env.example .env
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Cek service:

```bash
curl http://127.0.0.1:8001/health
```

## Git Branch

Branch setup yang dibuat:

```bash
setup/project-scaffold
```

Folder lama `project-1/` dan `smartlock-deka/` di-ignore dari repo root agar tidak ikut ter-commit saat push project baru.
