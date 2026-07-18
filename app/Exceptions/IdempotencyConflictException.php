<?php

namespace App\Exceptions;

use RuntimeException;

class IdempotencyConflictException extends RuntimeException
{
    public static function reused(): self
    {
        return new self('Idempotency-Key has already been used with a different payload.');
    }
}
