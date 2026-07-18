<?php

namespace App\Services;

use App\Exceptions\AiRuntimeException;
use App\Exceptions\ModerationException;
use Illuminate\Support\Facades\Log;

class MessageModerationService
{
    public function __construct(
        private readonly AiRuntimeClient $aiRuntimeClient,
    ) {}

    /**
     * @throws ModerationException
     */
    public function ensureAllowed(string $content): void
    {
        if (! (bool) config('services.ai_chat.moderation_enabled', false)) {
            return;
        }

        try {
            $result = $this->aiRuntimeClient->moderate($content);
        } catch (AiRuntimeException $exception) {
            Log::warning('Message moderation skipped because AI provider is unavailable.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return;
        }

        if (($result['allowed'] ?? true) === true) {
            return;
        }

        throw new ModerationException(
            reasonCode: (string) ($result['reason_code'] ?? 'MODERATION_BLOCKED'),
            message: (string) ($result['message'] ?? 'Message blocked by moderation policy.'),
        );
    }
}
