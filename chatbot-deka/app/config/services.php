<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'ai_chat' => [
        'provider' => env('AI_CHAT_PROVIDER', 'openai'),
        'model' => env('AI_CHAT_MODEL', 'gpt-4o-mini'),
        'fallback_provider' => env('AI_CHAT_FALLBACK_PROVIDER'),
        'fallback_model' => env('AI_CHAT_FALLBACK_MODEL'),
        'moderation_model' => env('MODERATION_MODEL'),
        'timeout' => env('AI_CHAT_TIMEOUT', 30),
        'rate_limit_per_minute' => env('AI_CHAT_RATE_LIMIT_PER_MINUTE', 20),
        'max_history_messages' => env('AI_CHAT_MAX_HISTORY_MESSAGES', 6),
        'max_history_characters' => env('AI_CHAT_MAX_HISTORY_CHARACTERS', 6000),
        'idempotency_ttl_minutes' => env('AI_CHAT_IDEMPOTENCY_TTL_MINUTES', 10),
    ],

];
