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
            Log::warning('Message moderation failed because AI provider is unavailable.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'fail_closed' => (bool) config('services.ai_chat.moderation_fail_closed', true),
            ]);

            if ((bool) config('services.ai_chat.moderation_fail_closed', true)) {
                throw new ModerationException(
                    reasonCode: 'MODERATION_UNAVAILABLE',
                    message: 'Message could not be checked by the safety policy. Please try again shortly.',
                );
            }

            return;
        }

        if ($result['allowed'] === true) {
            return;
        }

        throw new ModerationException(
            reasonCode: $result['reason_code'] ?: 'MODERATION_BLOCKED',
            message: $result['message'] ?: 'Message blocked by moderation policy.',
        );
    }
}
