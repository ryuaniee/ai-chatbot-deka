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
        'answer_max_tokens' => env('AI_CHAT_ANSWER_MAX_TOKENS', 160),
        'temperature' => env('AI_CHAT_TEMPERATURE', 0.2),
        'idempotency_ttl_minutes' => env('AI_CHAT_IDEMPOTENCY_TTL_MINUTES', 10),
    ],

    'deka_knowledge' => [
        'enabled' => env('DEKA_KNOWLEDGE_ENABLED', false),
        'base_url' => env('DEKA_KNOWLEDGE_BASE_URL', 'https://deka.dev'),
        'max_pages' => env('DEKA_KNOWLEDGE_MAX_PAGES', 50),
        'http_timeout' => env('DEKA_KNOWLEDGE_HTTP_TIMEOUT', 45),
        'top_k' => env('DEKA_KNOWLEDGE_TOP_K', 3),
        'min_score' => env('DEKA_KNOWLEDGE_MIN_SCORE', 0.02),
        'max_context_characters' => env('DEKA_KNOWLEDGE_MAX_CONTEXT_CHARACTERS', 1800),
        'chunk_size' => env('DEKA_KNOWLEDGE_CHUNK_SIZE', 1200),
        'chunk_overlap' => env('DEKA_KNOWLEDGE_CHUNK_OVERLAP', 180),
        'out_of_context_response' => env(
            'DEKA_KNOWLEDGE_OUT_OF_CONTEXT_RESPONSE',
            'Saya tidak bisa menjawab karena pertanyaan ini tidak berkaitan dengan Deka. Coba tanyakan hal lain yang berkaitan dengan Deka.',
        ),
    ],

];
