# Production Security Checklist

Use this checklist before deploying Chatbot Deka to production.

## Required Environment

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://your-production-domain`
- `APP_KEY` must be generated with `php artisan key:generate`
- `ADMIN_PASSWORD` must be a unique strong password if the admin seeder is used
- `SESSION_SECURE_COOKIE=true`
- `SESSION_HTTP_ONLY=true`
- `SESSION_SAME_SITE=lax`
- `SESSION_ENCRYPT=true`
- `LOG_LEVEL=warning` or stricter
- `AI_CHAT_MODERATION_ENABLED=true`
- `AI_CHAT_MODERATION_FAIL_CLOSED=true`
- `AI_CHAT_OUTPUT_MODERATION_ENABLED=true` (assistant replies are moderated before being shown; adds one moderation call per reply)
- `AI_CHAT_STREAM_SAFETY_MODE=buffered` unless the deployment explicitly accepts live, unguarded deltas for lower latency
- `DEKA_KNOWLEDGE_ENABLED=true` only after trusted knowledge has been ingested

## Required Deploy Checks

- Run `php artisan migrate --force`
- Run `php artisan config:cache`
- Run `php artisan route:cache`
- Run `php artisan view:cache`
- Verify `/admin/*` routes require `auth`, `verified`, and `admin-user`
- Verify `/api/conversations/*` routes require `auth`, `verified`, and `regular-user`
- Verify HTTPS is enforced at the load balancer or web server
- Verify database, Redis, mail, Google OAuth, and AI provider secrets are not committed

## Account Safety

- Email uniqueness must use `canonical_email`
- Gmail dots, Gmail plus aliases, and `googlemail.com` aliases must resolve to the same user
- Password reset requests should not reveal whether an email exists
- Google OAuth must only accept verified Google email addresses
- Production passwords must use Laravel's production `Password::default()` rules

## Data Access

- Users must only see their own conversations and messages
- Feedback must only be submitted for assistant messages inside the user's own conversation
- Admin dashboard access must remain admin-only
- Regular admins should not share accounts; create named admin accounts for audit logs

## LLM Output Safety

- Assistant replies containing internal prompt markers (`DEKA_KNOWLEDGE_*`, `BEGIN_DEKA_CANDIDATES`, `BEGIN_FEEDBACK_IMPROVEMENTS`, etc.) are always replaced with a safe fallback and logged as warnings
- With `AI_CHAT_OUTPUT_MODERATION_ENABLED=true`, assistant replies are also checked by the output moderation agent; blocked replies are replaced with a safe fallback and logged
- Output moderation is fail-open by design (replies are shown if the moderation provider is down); user-input moderation remains fail-closed
- Streaming safety: with `AI_CHAT_STREAM_SAFETY_MODE=buffered`, generated deltas are held until the final assistant output guard passes, then the guarded answer is emitted. `live` mode sends raw deltas immediately and should only be used when that risk is accepted.
