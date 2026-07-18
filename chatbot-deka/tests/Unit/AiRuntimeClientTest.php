<?php

namespace Tests\Unit;

use App\Ai\Agents\ConversationReplyAgent;
use App\Exceptions\AiRuntimeConfigurationException;
use App\Exceptions\AiRuntimeException;
use App\Services\AiRuntimeClient;
use Laravel\Ai\Exceptions\AiException;
use Laravel\Ai\Exceptions\RateLimitedException;
use Tests\TestCase;

class AiRuntimeClientTest extends TestCase
{
    public function test_it_maps_a_successful_response(): void
    {
        ConversationReplyAgent::fake(['Hello']);

        $response = app(AiRuntimeClient::class)->respond(1, 2, [
            ['role' => 'user', 'content' => 'Hi'],
        ]);

        $this->assertSame('Hello', $response['message']['content']);
        $this->assertSame('assistant', $response['message']['role']);

        ConversationReplyAgent::assertPrompted('Hi');
    }

    public function test_it_throws_a_domain_exception_for_ai_failures(): void
    {
        ConversationReplyAgent::fake([
            fn () => throw new AiException('Unable to generate assistant response.'),
        ]);

        try {
            app(AiRuntimeClient::class)->respond(1, 2, [
                ['role' => 'user', 'content' => 'Hi'],
            ]);
        } catch (AiRuntimeException $exception) {
            $this->assertSame(502, $exception->status);
            $this->assertSame('AI_RUNTIME_UNAVAILABLE', $exception->errorCode);
            $this->assertSame('Unable to generate assistant response.', $exception->getMessage());

            return;
        }

        $this->fail('Expected AiRuntimeException to be thrown.');
    }

    public function test_it_rejects_unknown_provider_configuration(): void
    {
        config()->set('services.ai_chat.provider', 'missing-provider');

        $this->expectException(AiRuntimeConfigurationException::class);

        app(AiRuntimeClient::class)->respond(1, 2, [
            ['role' => 'user', 'content' => 'Hi'],
        ]);
    }

    public function test_it_maps_provider_rate_limits_without_losing_status(): void
    {
        ConversationReplyAgent::fake([
            fn () => throw RateLimitedException::forProvider('openai', 429),
        ]);

        try {
            app(AiRuntimeClient::class)->respond(1, 2, [
                ['role' => 'user', 'content' => 'Hi'],
            ]);
        } catch (AiRuntimeException $exception) {
            $this->assertSame(429, $exception->status);
            $this->assertSame('AI_RUNTIME_RATE_LIMITED', $exception->errorCode);

            return;
        }

        $this->fail('Expected AiRuntimeException to be thrown.');
    }
}
