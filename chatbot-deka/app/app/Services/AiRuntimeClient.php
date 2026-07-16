<?php

namespace App\Services;

use App\Ai\Agents\ConversationReplyAgent;
use App\Ai\Agents\ConversationTitleAgent;
use App\Ai\Agents\MessageModerationAgent;
use App\Exceptions\AiRuntimeConfigurationException;
use App\Exceptions\AiRuntimeException;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Laravel\Ai\Exceptions\AiException;
use Laravel\Ai\Exceptions\InsufficientCreditsException;
use Laravel\Ai\Exceptions\ProviderOverloadedException;
use Laravel\Ai\Exceptions\RateLimitedException;
use Laravel\Ai\Responses\AgentResponse;
use Laravel\Ai\Responses\StreamableAgentResponse;
use LogicException;
use RuntimeException;
use Throwable;

class AiRuntimeClient
{
    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: array<string, mixed>|null,
     *     model: string|null
     * }
     */
    public function respond(int $conversationId, int $userId, array $messages, string $knowledgeContext = ''): array
    {
        [$history, $prompt] = $this->splitConversationContext($messages);

        try {
            $response = ConversationReplyAgent::make(messages: $history, knowledgeContext: $knowledgeContext)->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        return $this->normalizeAgentResponse($response);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function stream(int $conversationId, int $userId, array $messages, string $knowledgeContext = ''): StreamableAgentResponse
    {
        [$history, $prompt] = $this->splitConversationContext($messages);

        try {
            return ConversationReplyAgent::make(messages: $history, knowledgeContext: $knowledgeContext)->stream(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }
    }

    /**
     * @return array{allowed: bool, reason_code: string|null, message: string|null}
     */
    public function moderate(string $content): array
    {
        try {
            $response = MessageModerationAgent::make()->prompt(
                $content,
                provider: $this->providerMatrix(
                    modelOverride: $this->nullableString(config('services.ai_chat.moderation_model')),
                ),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        return [
            'allowed' => (bool) Arr::get($response, 'allowed', false),
            'reason_code' => $this->nullableString(Arr::get($response, 'reason_code')),
            'message' => $this->nullableString(Arr::get($response, 'message')),
        ];
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function generateTitle(array $messages): ?string
    {
        try {
            $response = ConversationTitleAgent::make(messages: $messages)->prompt(
                'Generate the title now.',
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $title = trim($response->text);
        $title = trim($title, " \t\n\r\0\x0B\"'");

        return $title !== '' ? mb_substr($title, 0, 80) : null;
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{0: array<int, array{role: string, content: string}>, 1: string}
     */
    private function splitConversationContext(array $messages): array
    {
        if ($messages === []) {
            throw AiRuntimeException::upstreamFailure(
                'Conversation context is empty.',
                422,
                'INVALID_CHAT_CONTEXT',
            );
        }

        $promptMessage = Arr::last($messages);
        $history = array_slice($messages, 0, -1);
        $role = $promptMessage['role'] ?? null;
        $prompt = trim((string) ($promptMessage['content'] ?? ''));

        if ($role !== 'user' || $prompt === '') {
            throw AiRuntimeException::upstreamFailure(
                'Conversation context must end with a user message.',
                422,
                'INVALID_CHAT_CONTEXT',
            );
        }

        return [$history, $prompt];
    }

    /**
     * @return array<string, string|null>
     */
    private function providerMatrix(?string $modelOverride = null): array
    {
        $primaryProvider = trim((string) config('services.ai_chat.provider', ''));
        $primaryModel = $modelOverride ?? $this->nullableString(config('services.ai_chat.model'));

        if ($primaryProvider === '') {
            throw new AiRuntimeConfigurationException('AI chat provider must be configured.');
        }

        $matrix = [
            $primaryProvider => $primaryModel,
        ];

        $fallbackProvider = trim((string) config('services.ai_chat.fallback_provider', ''));

        if ($fallbackProvider !== '') {
            $matrix[$fallbackProvider] = $this->nullableString(config('services.ai_chat.fallback_model'));
        }

        foreach (array_keys($matrix) as $provider) {
            if (! is_array(config("ai.providers.{$provider}"))) {
                throw new AiRuntimeConfigurationException(sprintf(
                    'AI provider [%s] is not configured in config(ai.providers).',
                    $provider,
                ));
            }
        }

        return $matrix;
    }

    private function timeout(): int
    {
        return (int) config('services.ai_chat.timeout', 30);
    }

    /**
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: array<string, mixed>|null,
     *     model: string|null
     * }
     */
    private function normalizeAgentResponse(AgentResponse $response): array
    {
        return [
            'message' => [
                'role' => 'assistant',
                'content' => $response->text,
            ],
            'usage' => $response->usage->toArray(),
            'model' => $response->meta->model,
        ];
    }

    private function nullableString(mixed $value): ?string
    {
        $string = trim((string) $value);

        return $string !== '' ? $string : null;
    }

    private function mapException(Throwable $exception): AiRuntimeException|AiRuntimeConfigurationException
    {
        if ($exception instanceof AiRuntimeException || $exception instanceof AiRuntimeConfigurationException) {
            return $exception;
        }

        if ($exception instanceof RateLimitedException) {
            return AiRuntimeException::rateLimited($exception->getMessage(), $exception);
        }

        if ($exception instanceof ProviderOverloadedException) {
            return AiRuntimeException::upstreamFailure(
                $exception->getMessage(),
                503,
                'AI_PROVIDER_OVERLOADED',
                $exception,
            );
        }

        if ($exception instanceof InsufficientCreditsException) {
            return AiRuntimeException::upstreamFailure(
                $exception->getMessage(),
                503,
                'AI_PROVIDER_INSUFFICIENT_CREDITS',
                $exception,
            );
        }

        if ($exception instanceof LogicException || $exception instanceof RuntimeException) {
            if (Str::contains(strtolower($exception->getMessage()), [
                'configured',
                'provider',
                'credential',
                'api key',
            ])) {
                return new AiRuntimeConfigurationException($exception->getMessage());
            }
        }

        if ($exception instanceof AiException) {
            return AiRuntimeException::unavailable($exception->getMessage(), $exception);
        }

        return AiRuntimeException::unavailable($exception->getMessage(), $exception);
    }
}
