<?php

namespace App\Services;

use App\Ai\Agents\AssistantOutputModerationAgent;
use App\Ai\Agents\ConversationReplyAgent;
use App\Ai\Agents\ConversationTitleAgent;
use App\Ai\Agents\FeedbackImprovementAgent;
use App\Ai\Agents\KnowledgeCandidateRerankerAgent;
use App\Ai\Agents\KnowledgeIntentPlannerAgent;
use App\Ai\Agents\KnowledgeSearchQueryAgent;
use App\Ai\Agents\KnowledgeValidationJudgeAgent;
use App\Ai\Agents\KnowledgeValidationProbeAgent;
use App\Ai\Agents\MessageModerationAgent;
use App\Exceptions\AiRuntimeConfigurationException;
use App\Exceptions\AiRuntimeException;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Laravel\Ai\Exceptions\AiException;
use Laravel\Ai\Exceptions\InsufficientCreditsException;
use Laravel\Ai\Exceptions\ProviderOverloadedException;
use Laravel\Ai\Exceptions\RateLimitedException;
use Laravel\Ai\Responses\AgentResponse;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\StreamableAgentResponse;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Laravel\Ai\Streaming\Events\StreamEnd;
use Laravel\Ai\Streaming\Events\StreamEvent;
use Laravel\Ai\Streaming\Events\StreamStart;
use Laravel\Ai\Streaming\Events\TextDelta;
use Laravel\Ai\Streaming\Events\TextEnd;
use Laravel\Ai\Streaming\Events\TextStart;
use LogicException;
use RuntimeException;
use Throwable;

class AiRuntimeClient
{
    private const KNOWLEDGE_INTENTS = [
        'person_identity',
        'company_team',
        'company_address',
        'company_services',
        'company_products',
        'company_projects',
        'company_contact',
        'company_profile',
        'pricing',
        'assistant_capability',
        'other_deka_fact',
        'out_of_scope',
    ];

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: array<string, mixed>|null,
     *     model: string|null
     * }
     */
    public function respond(int $conversationId, int $userId, array $messages): array
    {
        [$history, $prompt] = $this->splitConversationContext($messages);

        try {
            $response = ConversationReplyAgent::make(messages: $history)->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        return $this->normalizeAgentResponse($response);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function stream(int $conversationId, int $userId, array $messages): StreamableAgentResponse
    {
        [$history, $prompt] = $this->splitConversationContext($messages);

        if (
            strtolower((string) config('services.ai_chat.provider')) === 'gemini'
            && (bool) config('services.ai_chat.curl_streaming_enabled', false)
        ) {
            return $this->streamWithGeminiCurl([...$history, ['role' => 'user', 'content' => $prompt]]);
        }

        // The Laravel AI gateway has a native Gemini SSE implementation
        // (models/{model}:streamGenerateContent). The custom cURL path uses
        // the OpenAI /responses protocol and must not be used for Gemini.
        if (
            (bool) config('services.ai_chat.curl_streaming_enabled', false)
            && strtolower((string) config('services.ai_chat.provider')) !== 'gemini'
        ) {
            return $this->streamWithCurl([...$history, ['role' => 'user', 'content' => $prompt]]);
        }

        try {
            return ConversationReplyAgent::make(messages: $history)->stream(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }
    }

    /**
     * @return array{allowed: bool, reason_code: string|null, message: string|null}
     */
    public function moderate(string $content): array
    {
        try {
            $response = MessageModerationAgent::make()->prompt(
                $content,
                provider: $this->providerMatrix(
                    modelOverride: $this->nullableString(config('services.ai_chat.moderation_model')),
                ),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $structured = $this->structuredResponseData($response);

        return [
            'allowed' => (bool) Arr::get($structured, 'allowed', false),
            'reason_code' => $this->nullableString(Arr::get($structured, 'reason_code')),
            'message' => $this->nullableString(Arr::get($structured, 'message')),
        ];
    }

    /**
     * @return array{allowed: bool, reason_code: string|null, message: string|null}
     */
    public function moderateAssistantOutput(string $content): array
    {
        try {
            $response = AssistantOutputModerationAgent::make()->prompt(
                $content,
                provider: $this->providerMatrix(
                    modelOverride: $this->nullableString(config('services.ai_chat.moderation_model')),
                ),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $structured = $this->structuredResponseData($response);

        return [
            'allowed' => (bool) Arr::get($structured, 'allowed', false),
            'reason_code' => $this->nullableString(Arr::get($structured, 'reason_code')),
            'message' => $this->nullableString(Arr::get($structured, 'message')),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function structuredResponseData(AgentResponse $response): array
    {
        if ($response instanceof StructuredAgentResponse) {
            return $response->toArray();
        }

        $decoded = json_decode($response->text, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function generateTitle(array $messages): ?string
    {
        try {
            $response = ConversationTitleAgent::make(messages: $messages)->prompt(
                'Generate the title now.',
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $title = trim($response->text);
        $title = trim($title, " \t\n\r\0\x0B\"'");

        return $title !== '' ? mb_substr($title, 0, 80) : null;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{text: string, usage: array<string, mixed>|null, model: string|null}
     */
    public function generateFeedbackImprovement(array $payload): array
    {
        $prompt = "Review this disliked Deka chatbot answer and write the future improvement note.\n\n"
            ."USER_EMAIL:\n".($payload['user'] ?? '-')."\n\n"
            ."CONVERSATION_TITLE:\n".($payload['conversation'] ?? '-')."\n\n"
            ."USER_QUESTION:\n".($payload['question'] ?? '-')."\n\n"
            ."OLD_ASSISTANT_ANSWER:\n".($payload['old_answer'] ?? '-')."\n\n"
            ."DISLIKE_REASON:\n".($payload['feedback_reason'] ?? '-')."\n\n"
            ."RECENT_CONTEXT:\n".($payload['context'] ?? '-');

        try {
            $response = FeedbackImprovementAgent::make()->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        return [
            'text' => trim($response->text),
            'usage' => $response->usage->toArray(),
            'model' => $response->meta->model,
        ];
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array<int, string>
     */
    public function rewriteKnowledgeQueries(string $question, array $history = []): array
    {
        $question = trim($question);

        if ($question === '') {
            return [];
        }

        $prompt = $question;

        if ($history !== []) {
            $context = collect($history)
                ->slice(-4)
                ->map(static fn (array $message): string => sprintf('%s: %s', $message['role'], $message['content']))
                ->implode("\n");

            $prompt = "Conversation context:\n{$context}\n\nLatest user question:\n{$question}";
        }

        try {
            $response = KnowledgeSearchQueryAgent::make()->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        return $this->parseKnowledgeQueries($response->text, $question);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array<int, array{intent: string, question: string, queries: array<int, string>}>
     */
    public function planKnowledgeIntents(string $question, array $history = []): array
    {
        $question = trim($question);

        if ($question === '') {
            return [];
        }

        $prompt = $question;

        if ($history !== []) {
            $context = collect($history)
                ->slice(-4)
                ->map(static fn (array $message): string => sprintf('%s: %s', $message['role'], $message['content']))
                ->implode("\n");

            $prompt = "Conversation context:\n{$context}\n\nLatest user question:\n{$question}";
        }

        try {
            $response = KnowledgeIntentPlannerAgent::make()->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        return $this->parseKnowledgeIntents($response->text, $question);
    }

    /**
     * @param  array<int, array<string, mixed>>  $intentRetrievals
     * @return array<string, mixed>
     */
    public function rerankKnowledgeCandidates(string $question, array $intentRetrievals): array
    {
        $candidateBlocks = collect($intentRetrievals)
            ->map(function (array $intent): string {
                return 'INTENT: '.($intent['intent'] ?? 'other_deka_fact')."\n"
                    .'QUESTION: '.($intent['question'] ?? '')."\n"
                    .'CANDIDATES:'."\n"
                    .($intent['context'] ?? '');
            })
            ->implode("\n\n---\n\n");

        if (trim($candidateBlocks) === '') {
            return [];
        }

        $prompt = "USER_QUESTION:\n{$question}\n\nINTENT_CANDIDATES:\n{$candidateBlocks}";

        try {
            $response = KnowledgeCandidateRerankerAgent::make()->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: $this->timeout(),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $decoded = json_decode(trim($response->text), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @return array<int, array{question: string, required_facts: array<int, string>}>
     */
    public function generateKnowledgeValidationProbes(string $chunk, int $count = 3): array
    {
        $prompt = "KNOWLEDGE_CHUNK_UNTRUSTED_DATA:\n{$chunk}\n\nCreate {$count} probes.";

        try {
            $response = KnowledgeValidationProbeAgent::make()->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: (int) config('services.deka_knowledge.validation_timeout', 60),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $decoded = json_decode(trim($response->text), true);

        return collect(is_array($decoded['probes'] ?? null) ? $decoded['probes'] : [])
            ->map(static function (array $probe): array {
                $requiredFacts = is_array($probe['required_facts'] ?? null)
                    ? $probe['required_facts']
                    : [];

                return [
                    'question' => trim((string) ($probe['question'] ?? '')),
                    'required_facts' => collect($requiredFacts)
                        ->map(static fn (mixed $fact): string => trim((string) $fact))
                        ->filter()
                        ->values()
                        ->all(),
                ];
            })
            ->filter(static fn (array $probe): bool => $probe['question'] !== '' && $probe['required_facts'] !== [])
            ->take($count)
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $requiredFacts
     * @return array{grounded: bool, complete: bool, contradiction: bool, reason: string}
     */
    public function judgeKnowledgeValidationAnswer(
        string $question,
        array $requiredFacts,
        string $source,
        string $answer,
    ): array {
        $prompt = "QUESTION:\n{$question}\n\nREQUIRED_FACTS:\n"
            .json_encode($requiredFacts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ."\n\nSOURCE_CHUNK:\n{$source}\n\nASSISTANT_ANSWER:\n{$answer}";

        try {
            $response = KnowledgeValidationJudgeAgent::make()->prompt(
                $prompt,
                provider: $this->providerMatrix(),
                timeout: (int) config('services.deka_knowledge.validation_timeout', 60),
            );
        } catch (Throwable $exception) {
            throw $this->mapException($exception);
        }

        $decoded = json_decode(trim($response->text), true);

        return [
            'grounded' => (bool) ($decoded['grounded'] ?? false),
            'complete' => (bool) ($decoded['complete'] ?? false),
            'contradiction' => (bool) ($decoded['contradiction'] ?? true),
            'reason' => trim((string) ($decoded['reason'] ?? 'Invalid judge response.')),
        ];
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array{0: array<int, array{role: string, content: string}>, 1: string}
     */
    private function splitConversationContext(array $messages): array
    {
        if ($messages === []) {
            throw AiRuntimeException::upstreamFailure(
                'Conversation context is empty.',
                422,
                'INVALID_CHAT_CONTEXT',
            );
        }

        $promptMessage = Arr::last($messages);
        $history = array_slice($messages, 0, -1);
        $role = $promptMessage['role'] ?? null;
        $prompt = trim((string) ($promptMessage['content'] ?? ''));

        if ($role !== 'user' || $prompt === '') {
            throw AiRuntimeException::upstreamFailure(
                'Conversation context must end with a user message.',
                422,
                'INVALID_CHAT_CONTEXT',
            );
        }

        return [$history, $prompt];
    }

    /**
     * @return array<string, string|null>
     */
    private function providerMatrix(?string $modelOverride = null): array
    {
        $primaryProvider = trim((string) config('services.ai_chat.provider', ''));
        $primaryModel = $modelOverride ?? $this->nullableString(config('services.ai_chat.model'));

        if ($primaryProvider === '') {
            throw new AiRuntimeConfigurationException('AI chat provider must be configured.');
        }

        $matrix = [
            $primaryProvider => $primaryModel,
        ];

        $fallbackProvider = trim((string) config('services.ai_chat.fallback_provider', ''));

        if ($fallbackProvider !== '') {
            $matrix[$fallbackProvider] = $this->nullableString(config('services.ai_chat.fallback_model'));
        }

        foreach (array_keys($matrix) as $provider) {
            if (! is_array(config("ai.providers.{$provider}"))) {
                throw new AiRuntimeConfigurationException(sprintf(
                    'AI provider [%s] is not configured in config(ai.providers).',
                    $provider,
                ));
            }
        }

        return $matrix;
    }

    private function timeout(): int
    {
        return (int) config('services.ai_chat.timeout', 30);
    }

    /**
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: array<string, mixed>|null,
     *     model: string|null
     * }
     */
    private function normalizeAgentResponse(AgentResponse $response): array
    {
        return [
            'message' => [
                'role' => 'assistant',
                'content' => $response->text,
            ],
            'usage' => $response->usage->toArray(),
            'model' => $response->meta->model,
        ];
    }

    private function nullableString(mixed $value): ?string
    {
        $string = trim((string) $value);

        return $string !== '' ? $string : null;
    }

    /**
     * @return array<int, string>
     */
    private function parseKnowledgeQueries(string $content, string $fallback): array
    {
        $decoded = json_decode(trim($content), true);

        if (! is_array($decoded)) {
            $decoded = preg_split('/\R+/', $content) ?: [];
        }

        $queries = collect($decoded)
            ->map(static fn (mixed $query): string => trim((string) $query, " \t\n\r\0\x0B-•0123456789."))
            ->filter(static fn (string $query): bool => $query !== '')
            ->unique(static fn (string $query): string => mb_strtolower($query))
            ->take((int) config('services.deka_knowledge.query_rewrite_limit', 5))
            ->values()
            ->all();

        return collect([$fallback, ...$queries])
            ->filter(static fn (string $query): bool => $query !== '')
            ->unique(static fn (string $query): string => mb_strtolower($query))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{intent: string, question: string, queries: array<int, string>}>
     */
    private function parseKnowledgeIntents(string $content, string $fallback): array
    {
        $decoded = json_decode(trim($content), true);

        if (! is_array($decoded)) {
            return [[
                'intent' => 'other_deka_fact',
                'question' => $fallback,
                'queries' => [$fallback],
            ]];
        }

        return collect($decoded)
            ->map(function (mixed $item) use ($fallback): ?array {
                if (! is_array($item)) {
                    return null;
                }

                $intent = trim((string) ($item['intent'] ?? 'other_deka_fact'));
                $question = trim((string) ($item['question'] ?? $fallback));
                $queries = $item['queries'] ?? [];

                if (! is_array($queries)) {
                    $queries = [$question];
                }

                $queries = collect($queries)
                    ->map(static fn (mixed $query): string => trim((string) $query))
                    ->filter(static fn (string $query): bool => $query !== '')
                    ->unique(static fn (string $query): string => mb_strtolower($query))
                    ->take(5)
                    ->values()
                    ->all();
                $queries = collect([$question, ...$queries])
                    ->filter(static fn (string $query): bool => $query !== '')
                    ->unique(static fn (string $query): string => mb_strtolower($query))
                    ->take(5)
                    ->values()
                    ->all();

                if ($question === '' || $queries === []) {
                    return null;
                }

                if (! in_array($intent, self::KNOWLEDGE_INTENTS, true)) {
                    $intent = 'other_deka_fact';
                }

                return [
                    'intent' => $intent,
                    'question' => $question,
                    'queries' => $queries,
                ];
            })
            ->filter()
            ->take(4)
            ->values()
            ->all();
    }

    /**
     * The Laravel HTTP/Guzzle streaming path can hang against the local
     * codex.deka.dev proxy, while native cURL receives SSE events correctly.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    private function streamWithCurl(array $messages): StreamableAgentResponse
    {
        $invocationId = (string) Str::uuid();
        $model = $this->nullableString(config('services.ai_chat.model')) ?? 'gemini-2.5-flash';

        return new StreamableAgentResponse(
            $invocationId,
            function () use ($invocationId, $messages, $model) {
                yield from $this->curlResponseStreamEvents($invocationId, $messages, $model);
            },
            new Meta('openai', $model),
        );
    }

    private function streamWithGeminiCurl(array $messages): StreamableAgentResponse
    {
        $invocationId = (string) Str::uuid();
        $model = $this->nullableString(config('services.ai_chat.model')) ?? 'gemini-2.5-flash';

        return new StreamableAgentResponse($invocationId, function () use ($invocationId, $messages, $model) {
            yield from $this->geminiCurlEvents($invocationId, $messages, $model);
        }, new Meta('gemini', $model));
    }

    private function geminiCurlEvents(string $invocationId, array $messages, string $model): \Generator
    {
        $url = rtrim((string) config('ai.providers.gemini.url'), '/').'/models/'.rawurlencode($model).':streamGenerateContent?alt=sse';
        $key = (string) config('ai.providers.gemini.key');
        $contents = array_map(static fn (array $message): array => [
            'role' => $message['role'] === 'assistant' ? 'model' : 'user',
            'parts' => [['text' => $message['content']]],
        ], $messages);
        $body = json_encode([
            'contents' => $contents,
            'system_instruction' => ['parts' => [['text' => (string) ConversationReplyAgent::make()->instructions()]]],
            'generationConfig' => ['maxOutputTokens' => ConversationReplyAgent::make()->maxTokens()],
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        $messageId = (string) Str::uuid();
        $started = false;
        $buffer = '';
        $queue = [];
        $parse = function (string $chunk) use (&$buffer, &$queue, &$started, $messageId, $invocationId, $model): void {
            $buffer .= str_replace("\r\n", "\n", $chunk);
            while (($pos = strpos($buffer, "\n\n")) !== false) {
                $event = substr($buffer, 0, $pos); $buffer = substr($buffer, $pos + 2);
                $json = '';
                foreach (explode("\n", $event) as $line) if (str_starts_with($line, 'data:')) $json .= ltrim(substr($line, 5));
                $data = json_decode(trim($json), true);
                $text = (string) data_get($data, 'candidates.0.content.parts.0.text', '');
                if ($text !== '') {
                    if (! $started) { $started = true; $queue[] = (new TextStart((string) Str::uuid(), $messageId, time()))->withInvocationId($invocationId); }
                    $queue[] = (new TextDelta((string) Str::uuid(), $messageId, $text, time()))->withInvocationId($invocationId);
                }
            }
        };
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['x-goog-api-key: '.$key, 'Content-Type: application/json', 'Accept: text/event-stream'], CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => $this->timeout(), CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use ($parse): int { $parse($chunk); return strlen($chunk); }]);
        $mh = curl_multi_init(); curl_multi_add_handle($mh, $ch);
        do { do { $status = curl_multi_exec($mh, $running); } while ($status === CURLM_CALL_MULTI_PERFORM); while ($queue !== []) yield array_shift($queue); if ($running) curl_multi_select($mh, 0.2); } while ($running && $status === CURLM_OK);
        if (curl_errno($ch) || curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) throw AiRuntimeException::unavailable(curl_error($ch) ?: 'Gemini streaming request failed.');
        if ($started) { yield (new TextEnd((string) Str::uuid(), $messageId, time()))->withInvocationId($invocationId); yield (new StreamEnd((string) Str::uuid(), 'stop', new Usage, time()))->withInvocationId($invocationId); }
        curl_multi_remove_handle($mh, $ch); curl_multi_close($mh); curl_close($ch);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    private function curlResponseStreamEvents(string $invocationId, array $messages, string $model): \Generator
    {
        $url = rtrim((string) config('ai.providers.openai.url'), '/').'/responses';
        $apiKey = (string) config('ai.providers.openai.key');
        $messageId = (string) Str::uuid();
        $textStarted = false;
        $streamStarted = false;
        $sseBuffer = '';
        /** @var array<int, StreamEvent> $eventQueue */
        $eventQueue = [];
        $usage = new Usage;

        $body = json_encode([
            'model' => $model,
            'instructions' => (string) ConversationReplyAgent::make()->instructions(),
            'input' => array_map(
                static fn (array $message): array => [
                    'role' => $message['role'],
                    'content' => $message['content'],
                ],
                $messages,
            ),
            'max_output_tokens' => ConversationReplyAgent::make()->maxTokens(),
            'stream' => true,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $pushData = function (array $data) use (&$eventQueue, &$usage, &$textStarted, &$streamStarted, $invocationId, $model, $messageId): void {
            $type = (string) ($data['type'] ?? '');

            if ($type === 'response.created' && ! $streamStarted) {
                $streamStarted = true;
                $eventQueue[] = (new StreamStart(
                    (string) Str::uuid(),
                    'openai',
                    (string) data_get($data, 'response.model', $model),
                    time(),
                ))->withInvocationId($invocationId);

                return;
            }

            if ($type === 'response.output_text.delta') {
                $delta = (string) ($data['delta'] ?? '');

                if ($delta === '') {
                    return;
                }

                if (! $textStarted) {
                    $textStarted = true;
                    $eventQueue[] = (new TextStart((string) Str::uuid(), $messageId, time()))
                        ->withInvocationId($invocationId);
                }

                $eventQueue[] = (new TextDelta((string) Str::uuid(), $messageId, $delta, time()))
                    ->withInvocationId($invocationId);

                return;
            }

            if ($type === 'response.output_text.done' && $textStarted) {
                $eventQueue[] = (new TextEnd((string) Str::uuid(), $messageId, time()))
                    ->withInvocationId($invocationId);

                return;
            }

            if ($type === 'response.completed') {
                $usageData = (array) data_get($data, 'response.usage', []);
                $usage = new Usage(
                    promptTokens: (int) ($usageData['input_tokens'] ?? 0),
                    completionTokens: (int) ($usageData['output_tokens'] ?? 0),
                    reasoningTokens: (int) data_get($usageData, 'output_tokens_details.reasoning_tokens', 0),
                );
                $eventQueue[] = (new StreamEnd((string) Str::uuid(), 'stop', $usage, time()))
                    ->withInvocationId($invocationId);
            }
        };

        $parseSse = function (string $chunk) use (&$sseBuffer, $pushData): void {
            $sseBuffer .= $chunk;
            $sseBuffer = str_replace("\r\n", "\n", $sseBuffer);

            while (($pos = strpos($sseBuffer, "\n\n")) !== false) {
                $rawEvent = substr($sseBuffer, 0, $pos);
                $sseBuffer = substr($sseBuffer, $pos + 2);
                $dataLines = [];

                foreach (explode("\n", $rawEvent) as $line) {
                    if (str_starts_with($line, 'data:')) {
                        $dataLines[] = ltrim(substr($line, 5));
                    }
                }

                $payload = trim(implode("\n", $dataLines));

                if ($payload === '' || $payload === '[DONE]') {
                    continue;
                }

                $decoded = json_decode($payload, true);

                if (is_array($decoded)) {
                    $pushData($decoded);
                }
            }
        };

        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer '.$apiKey,
                'Content-Type: application/json',
                'Accept: text/event-stream',
            ],
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_TIMEOUT => $this->timeout(),
            CURLOPT_WRITEFUNCTION => function ($handle, string $chunk) use ($parseSse): int {
                $parseSse($chunk);

                return strlen($chunk);
            },
        ]);

        $multi = curl_multi_init();
        curl_multi_add_handle($multi, $handle);

        try {
            do {
                do {
                    $status = curl_multi_exec($multi, $running);
                } while ($status === CURLM_CALL_MULTI_PERFORM);

                while ($eventQueue !== []) {
                    yield array_shift($eventQueue);
                }

                if ($running) {
                    curl_multi_select($multi, 0.2);
                }
            } while ($running && $status === CURLM_OK);

            $error = curl_error($handle);
            $statusCode = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);

            if ($error !== '' || $statusCode >= 400) {
                throw AiRuntimeException::unavailable(
                    $error !== '' ? $error : "Streaming request failed with HTTP {$statusCode}.",
                );
            }
        } finally {
            curl_multi_remove_handle($multi, $handle);
            curl_multi_close($multi);
            curl_close($handle);
        }
    }

    private function mapException(Throwable $exception): AiRuntimeException|AiRuntimeConfigurationException
    {
        if ($exception instanceof AiRuntimeException || $exception instanceof AiRuntimeConfigurationException) {
            return $exception;
        }

        if ($exception instanceof RateLimitedException) {
            return AiRuntimeException::rateLimited($exception->getMessage(), $exception);
        }

        if ($exception instanceof ProviderOverloadedException) {
            return AiRuntimeException::upstreamFailure(
                $exception->getMessage(),
                503,
                'AI_PROVIDER_OVERLOADED',
                $exception,
            );
        }

        if ($exception instanceof InsufficientCreditsException) {
            return AiRuntimeException::upstreamFailure(
                $exception->getMessage(),
                503,
                'AI_PROVIDER_INSUFFICIENT_CREDITS',
                $exception,
            );
        }

        if ($exception instanceof LogicException || $exception instanceof RuntimeException) {
            if (Str::contains(strtolower($exception->getMessage()), [
                'configured',
                'provider',
                'credential',
                'api key',
            ])) {
                return new AiRuntimeConfigurationException($exception->getMessage());
            }
        }

        if ($exception instanceof AiException) {
            return AiRuntimeException::unavailable($exception->getMessage(), $exception);
        }

        return AiRuntimeException::unavailable($exception->getMessage(), $exception);
    }
}
