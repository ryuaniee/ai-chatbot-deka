<?php

namespace App\Services;

use App\Exceptions\ModerationException;

class MessageModerationService
{
    public function __construct(
        private readonly AiServiceClient $aiServiceClient,
    ) {
    }

    /**
     * @throws ModerationException
     */
    public function ensureAllowed(string $content): void
    {
        $result = $this->aiServiceClient->moderate($content);

        if (($result['allowed'] ?? true) === true) {
            return;
        }

        throw new ModerationException(
            reasonCode: (string) ($result['reason_code'] ?? 'MODERATION_BLOCKED'),
            message: (string) ($result['message'] ?? 'Message blocked by moderation policy.'),
        );
    }
}
