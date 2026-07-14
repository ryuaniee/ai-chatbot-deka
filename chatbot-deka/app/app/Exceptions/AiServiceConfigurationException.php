<?php

namespace App\Exceptions;

use RuntimeException;

class AiServiceConfigurationException extends RuntimeException
{
    public static function missingInternalToken(): self
    {
        return new self('AI service internal token must be configured with a non-placeholder value.');
    }

    public static function invalidInternalAuthentication(): self
    {
        return new self('AI service internal authentication is invalid or mismatched.');
    }
}
