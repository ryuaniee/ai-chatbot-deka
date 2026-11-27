<?php

namespace App\Exceptions;

use RuntimeException;

class ModerationException extends RuntimeException
{
    public function __construct(
        public readonly string $reasonCode,
        string $message = 'Message blocked by moderation policy.',
    ) {
        parent::__construct($message);
    }
}
