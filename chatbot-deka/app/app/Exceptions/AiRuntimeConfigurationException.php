<?php

namespace App\Exceptions;

use RuntimeException;

class AiRuntimeConfigurationException extends RuntimeException
{
    public static function missingInternalToken(): self
    {
        return new self('AI runtime configuration is incomplete.');
    }

    public static function invalidInternalAuthentication(): self
    {
        return new self('AI runtime authentication is invalid or mismatched.');
    }
}
