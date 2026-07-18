<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class HandleIdempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->shouldHandle($request)) {
            return $next($request);
        }

        $userId = $request->user()?->getAuthIdentifier();
        $idempotencyKey = trim((string) $request->header('Idempotency-Key'));
        $fingerprint = $this->fingerprint($request);
        $cacheKey = sprintf('idempotency:%s:%s:%s', $userId, $request->path(), $idempotencyKey);

        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            if (($cached['fingerprint'] ?? null) !== $fingerprint) {
                return response()->json([
                    'message' => 'Idempotency-Key has already been used with a different payload.',
                    'code' => 'IDEMPOTENCY_KEY_REUSED',
                ], 409);
            }

            return response($cached['body'], $cached['status'])
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-Idempotent-Replay' => 'true',
                ]);
        }

        /** @var Response $response */
        $response = Cache::lock("lock:{$cacheKey}", 10)->block(3, function () use ($request, $next, $cacheKey, $fingerprint) {
            $existing = Cache::get($cacheKey);

            if (is_array($existing)) {
                if (($existing['fingerprint'] ?? null) !== $fingerprint) {
                    return response()->json([
                        'message' => 'Idempotency-Key has already been used with a different payload.',
                        'code' => 'IDEMPOTENCY_KEY_REUSED',
                    ], 409);
                }

                return response($existing['body'], $existing['status'])
                    ->withHeaders([
                        'Content-Type' => 'application/json',
                        'X-Idempotent-Replay' => 'true',
                    ]);
            }

            /** @var Response $response */
            $response = $next($request);

            if ($this->shouldCacheResponse($response)) {
                Cache::put($cacheKey, [
                    'fingerprint' => $fingerprint,
                    'status' => $response->getStatusCode(),
                    'body' => $response->getContent(),
                ], now()->addMinutes((int) config('services.ai_chat.idempotency_ttl_minutes', 10)));
            }

            return $response;
        });

        return $response;
    }

    private function shouldHandle(Request $request): bool
    {
        return $request->isMethod('POST')
            && $request->is('api/*')
            && $request->expectsJson()
            && $request->user() !== null
            && trim((string) $request->header('Idempotency-Key')) !== '';
    }

    private function fingerprint(Request $request): string
    {
        return hash('sha256', implode('|', [
            $request->method(),
            $request->path(),
            json_encode($request->all(), JSON_THROW_ON_ERROR),
        ]));
    }

    private function shouldCacheResponse(Response $response): bool
    {
        return $response->getStatusCode() >= 200 && $response->getStatusCode() < 300;
    }
}
