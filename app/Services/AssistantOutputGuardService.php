<?php

namespace App\Services;

use App\Exceptions\AiRuntimeException;
use Illuminate\Support\Facades\Log;

class AssistantOutputGuardService
{
    private const INTERNAL_MARKERS = [
        'DEKA_KNOWLEDGE_CANDIDATES',
        'DEKA_KNOWLEDGE_CONTEXT',
        'DEKA_KNOWLEDGE_SELECTION_GUIDANCE',
        'DEKA_ADMIN_APPROVED_FEEDBACK_IMPROVEMENTS',
        'BEGIN_DEKA_CANDIDATES',
        'END_DEKA_CANDIDATES',
        'BEGIN_FEEDBACK_IMPROVEMENTS',
        'END_FEEDBACK_IMPROVEMENTS',
    ];

    public function __construct(
        private readonly AiRuntimeClient $aiRuntimeClient,
    ) {}

    /**
     * @param  array<string, mixed>  $logContext
     */
    public function guard(string $content, array $logContext = []): string
    {
        if (trim($content) === '') {
            return $content;
        }

        if ($this->containsInternalMarker($content)) {
            Log::warning('Assistant reply blocked: internal prompt scaffolding leaked into output.', $logContext);

            return $this->safeFallbackAnswer();
        }

        if ($this->outputModerationEnabled()) {
            return $this->moderate($content, $logContext);
        }

        return $content;
    }

    public function safeFallbackAnswer(): string
    {
        return 'Maaf, jawaban tidak dapat ditampilkan. Silakan ajukan pertanyaan Anda kembali.';
    }

    public function containsInternalMarker(string $content): bool
    {
        foreach (self::INTERNAL_MARKERS as $marker) {
            if (str_contains($content, $marker)) {
                return true;
            }
        }

        return false;
    }

    private function outputModerationEnabled(): bool
    {
        return (bool) config('services.ai_chat.moderation_enabled', false)
            && (bool) config('services.ai_chat.output_moderation_enabled', false);
    }

    /**
     * @param  array<string, mixed>  $logContext
     */
    private function moderate(string $content, array $logContext): string
    {
        try {
            $result = $this->aiRuntimeClient->moderateAssistantOutput($content);
        } catch (AiRuntimeException $exception) {
            Log::warning('Assistant output moderation unavailable; reply allowed fail-open.', [
                ...$logContext,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return $content;
        }

        if ($result['allowed'] === true) {
            return $content;
        }

        Log::warning('Assistant reply blocked by output moderation.', [
            ...$logContext,
            'reason_code' => $result['reason_code'] ?: 'MODERATION_BLOCKED',
        ]);

        return $this->safeFallbackAnswer();
    }
}
