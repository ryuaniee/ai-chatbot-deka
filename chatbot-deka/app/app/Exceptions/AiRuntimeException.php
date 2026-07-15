<?php

namespace App\Exceptions;

use RuntimeException;

class AiRuntimeException extends RuntimeException
{
    public function __construct(
        string $message = 'AI runtime is unavailable.',
        public readonly int $status = 502,
        public readonly ?string $errorCode = 'AI_RUNTIME_UNAVAILABLE',
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, previous: $previous);
    }

    public static function unavailable(
        string $message = 'AI runtime is unavailable.',
        ?\Throwable $previous = null,
    ): self
    {
        return new self($message, 502, 'AI_RUNTIME_UNAVAILABLE', $previous);
    }

    public static function rateLimited(
        string $message = 'AI runtime rate limit exceeded.',
        ?\Throwable $previous = null,
    ): self
    {
        return new self($message, 429, 'AI_RUNTIME_RATE_LIMITED', $previous);
    }

    public static function upstreamFailure(
        string $message,
        int $status,
        ?string $errorCode = null,
        ?\Throwable $previous = null,
    ): self
    {
        return new self(
            $message,
            $status >= 400 ? $status : 502,
            $errorCode ?? 'AI_RUNTIME_UNAVAILABLE',
            $previous,
        );
    }
}
