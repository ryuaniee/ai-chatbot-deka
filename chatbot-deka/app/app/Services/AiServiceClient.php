<?php

namespace App\Services;

use App\Exceptions\AiServiceConfigurationException;
use App\Exceptions\AiServiceException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\RequestException;

class AiServiceClient
{
    public function __construct(
        private readonly HttpFactory $http,
    ) {
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: array<string, mixed>|null,
     *     model: string|null
     * }
     */
    public function respond(int $conversationId, int $userId, array $messages): array
    {
        return $this->post('/chat/respond', [
            'conversation_id' => $conversationId,
            'user_id' => $userId,
            'messages' => $messages,
        ]);
    }

    /**
     * @return array{allowed: bool, reason_code: string|null, message: string|null}
     */
    public function moderate(string $content): array
    {
        $response = $this->post('/chat/moderate', [
            'content' => $content,
        ]);

        return [
            'allowed' => (bool) ($response['allowed'] ?? false),
            'reason_code' => $response['reason_code'] ?? null,
            'message' => $response['message'] ?? null,
        ];
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function generateTitle(array $messages): ?string
    {
        $response = $this->post('/chat/title', [
            'messages' => $messages,
        ]);

        $title = trim((string) ($response['title'] ?? ''));

        return $title !== '' ? mb_substr($title, 0, 80) : null;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function post(string $path, array $payload): array
    {
        try {
            $request = $this->http
                ->baseUrl(rtrim((string) config('services.ai_service.url'), '/'))
                ->timeout((int) config('services.ai_service.timeout', 30))
                ->acceptJson()
                ->asJson();

            $token = config('services.ai_service.internal_token');

            if (! is_string($token) || $token === '' || $token === 'change-this-in-production') {
                throw AiServiceConfigurationException::missingInternalToken();
            }

            $headers = [
                'X-Internal-Token' => $token,
                'X-Request-Source' => 'laravel-app',
            ];

            $requestId = request()?->attributes?->get('request_id');

            if (is_string($requestId) && $requestId !== '') {
                $headers['X-Request-Id'] = $requestId;
            }

            $request = $request->withHeaders($headers);

            return $request
                ->post($path, $payload)
                ->throw()
                ->json();
        } catch (ConnectionException $exception) {
            throw AiServiceException::unavailable(previous: $exception);
        } catch (RequestException $exception) {
            $response = $exception->response;
            $status = $response->status();
            $body = $response->json();
            $errorCode = data_get($body, 'detail.code') ?? data_get($body, 'code');
            $message = data_get($body, 'detail.message')
                ?? data_get($body, 'message')
                ?? 'AI service request failed.';

            if (in_array($errorCode, ['INTERNAL_AUTH_NOT_CONFIGURED', 'UNAUTHORIZED_INTERNAL_REQUEST'], true)) {
                throw AiServiceConfigurationException::invalidInternalAuthentication();
            }

            if ($status === 429) {
                throw AiServiceException::rateLimited($message, $exception);
            }

            throw AiServiceException::upstreamFailure(
                message: $message,
                status: $status,
                errorCode: is_string($errorCode) ? $errorCode : null,
                previous: $exception,
            );
        }
    }
}
