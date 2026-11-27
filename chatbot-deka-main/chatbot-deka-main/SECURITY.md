# Security Policy

## Supported Branch

Perbaikan keamanan ditargetkan ke branch `main`.

## Reporting a Vulnerability

Jangan buka public issue untuk credential leak, auth bypass, data exposure, atau vulnerability lain yang belum dipatch.

Laporkan secara privat ke maintainer repository melalui GitHub private vulnerability reporting jika tersedia. Jika belum tersedia, hubungi maintainer repository secara langsung dan sertakan:

- ringkasan masalah
- langkah reproduksi
- dampak yang terlihat
- versi/commit yang diuji

## Secrets

- Jangan commit `.env`, API key, token, credential database, private document, atau file export sensitif.
- Rotasi secret segera jika pernah tersalin ke log, issue, PR, atau commit.
- Gunakan environment variables atau GitHub Actions secrets untuk konfigurasi production/staging.

## Production Checklist

Lihat [Production Security Checklist](docs/production-security-checklist.md) sebelum deploy.
