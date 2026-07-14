<?php

namespace Tests\Unit;

use App\Exceptions\AiServiceConfigurationException;
use App\Exceptions\AiServiceException;
use App\Services\AiServiceClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiServiceClientTest extends TestCase
{
    public function test_it_maps_a_successful_response(): void
    {
        request()->attributes->set('request_id', 'req-test-123');

        Http::fake([
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Hello',
                ],
                'usage' => ['total_tokens' => 10],
                'model' => 'gpt-4o-mini',
            ]),
        ]);

        $response = app(AiServiceClient::class)->respond(1, 2, [
            ['role' => 'user', 'content' => 'Hi'],
        ]);

        $this->assertSame('Hello', $response['message']['content']);
        $this->assertSame('gpt-4o-mini', $response['model']);

        Http::assertSent(function ($request): bool {
            return $request->hasHeader('X-Internal-Token', 'test-internal-token')
                && $request->hasHeader('X-Request-Source', 'laravel-app')
                && $request->hasHeader('X-Request-Id', 'req-test-123');
        });
    }

    public function test_it_throws_a_domain_exception_for_http_errors(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'detail' => [
                    'code' => 'MODEL_UNAVAILABLE',
                    'message' => 'Unable to generate assistant response.',
                ],
            ], 500),
        ]);

        try {
            app(AiServiceClient::class)->respond(1, 2, [
                ['role' => 'user', 'content' => 'Hi'],
            ]);
        } catch (AiServiceException $exception) {
            $this->assertSame(500, $exception->status);
            $this->assertSame('MODEL_UNAVAILABLE', $exception->errorCode);
            $this->assertSame('Unable to generate assistant response.', $exception->getMessage());

            return;
        }

        $this->fail('Expected AiServiceException to be thrown.');
    }

    public function test_it_rejects_placeholder_internal_token_configuration(): void
    {
        config()->set('services.ai_service.internal_token', 'change-this-in-production');

        $this->expectException(AiServiceConfigurationException::class);

        app(AiServiceClient::class)->respond(1, 2, [
            ['role' => 'user', 'content' => 'Hi'],
        ]);
    }

    public function test_it_maps_upstream_rate_limits_without_losing_status(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'detail' => [
                    'code' => 'MODEL_RATE_LIMITED',
                    'message' => 'Please retry later.',
                ],
            ], 429),
        ]);

        try {
            app(AiServiceClient::class)->respond(1, 2, [
                ['role' => 'user', 'content' => 'Hi'],
            ]);
        } catch (AiServiceException $exception) {
            $this->assertSame(429, $exception->status);
            $this->assertSame('AI_SERVICE_RATE_LIMITED', $exception->errorCode);
            $this->assertSame('Please retry later.', $exception->getMessage());

            return;
        }

        $this->fail('Expected AiServiceException to be thrown.');
    }

    public function test_it_maps_internal_auth_failures_to_configuration_exception(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'detail' => [
                    'code' => 'UNAUTHORIZED_INTERNAL_REQUEST',
                    'message' => 'Invalid internal service token.',
                ],
            ], 401),
        ]);

        $this->expectException(AiServiceConfigurationException::class);

        app(AiServiceClient::class)->respond(1, 2, [
            ['role' => 'user', 'content' => 'Hi'],
        ]);
    }
}
