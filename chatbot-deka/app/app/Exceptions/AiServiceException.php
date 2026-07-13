<?php

namespace App\Exceptions;

use RuntimeException;

class AiServiceException extends RuntimeException
{
    public static function unavailable(
        string $message = 'AI service is unavailable.',
        ?\Throwable $previous = null,
    ): self
    {
        return new self($message, previous: $previous);
    }
}
