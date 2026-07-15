<?php

namespace App\Services;

use App\Exceptions\IdempotencyConflictException;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\Knowledge\DekaKnowledgeRetriever;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Responses\StreamableAgentResponse;
use Laravel\Ai\Responses\StreamedAgentResponse;
use stdClass;

class ConversationChatService
{
    public function __construct(
        private readonly AiRuntimeClient $aiRuntimeClient,
        private readonly MessageModerationService $messageModerationService,
        private readonly DekaKnowledgeRetriever $knowledgeRetriever,
    ) {}

    /**
     * @return array{0: Conversation, 1: Message, 2: Message}
     */
    public function startConversation(
        User $user,
        string $content,
        ?string $idempotencyKey = null,
    ): array {
        if ($idempotencyKey !== null) {
            $existingMessage = $this->findUserMessageByIdempotencyKey($user, $idempotencyKey);

            if ($existingMessage !== null) {
                if ($existingMessage->content !== $content) {
                    throw IdempotencyConflictException::reused();
                }

                $conversation = $existingMessage->conversation()->firstOrFail();
                [$userMessage, $assistantMessage] = $this->resumeOrSendAssistantReply(
                    $conversation,
                    $user,
                    $existingMessage,
                );

                return [$conversation, $userMessage, $assistantMessage];
            }
        }

        $this->messageModerationService->ensureAllowed($content);

        $conversation = $user->conversations()->create([
            'status' => 'active',
        ]);

        return [$conversation, ...$this->sendMessage(
            $conversation,
            $user,
            $content,
            moderated: true,
            idempotencyKey: $idempotencyKey,
        )];
    }

    /**
     * @return array{0: Message, 1: Message}
     */
    public function sendMessage(
        Conversation $conversation,
        User $user,
        string $content,
        bool $moderated = false,
        ?string $idempotencyKey = null,
    ): array {
        if (! $moderated) {
            $this->messageModerationService->ensureAllowed($content);
        }

        Log::info('Chat message received.', [
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'content_length' => mb_strlen($content),
        ]);

        $userMessage = DB::transaction(function () use ($conversation, $content, $idempotencyKey): Message {
            $lockedConversation = Conversation::query()
                ->whereKey($conversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($idempotencyKey !== null) {
                $existingMessage = $lockedConversation->messages()
                    ->where('role', 'user')
                    ->where('metadata->idempotency_key', $idempotencyKey)
                    ->first();

                if ($existingMessage !== null) {
                    if ($existingMessage->content !== $content) {
                        throw IdempotencyConflictException::reused();
                    }

                    return $existingMessage;
                }
            }

            $nextSequence = (int) $lockedConversation->messages()->max('sequence') + 1;

            $message = $lockedConversation->messages()->create([
                'role' => 'user',
                'content' => $content,
                'sequence' => $nextSequence,
                'metadata' => array_filter([
                    'idempotency_key' => $idempotencyKey,
                ]),
            ]);

            $lockedConversation->forceFill([
                'last_message_at' => $message->created_at,
            ])->save();

            return $message;
        });

        $conversation->load(['messages' => fn ($query) => $query->orderBy('sequence')]);

        [$userMessage, $assistantMessage] = $this->resumeOrSendAssistantReply(
            $conversation,
            $user,
            $userMessage,
        );

        if (blank($conversation->fresh()->title) && ! $this->isOutOfContextMessage($assistantMessage)) {
            $this->generateTitle($conversation);
        }

        Log::info('Chat response persisted.', [
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'assistant_message_id' => $assistantMessage->id,
            'model' => data_get($assistantMessage->metadata, 'model'),
        ]);

        return [$userMessage->fresh(), $assistantMessage->fresh()];
    }

    /**
     * @return array{
     *     conversation: Conversation,
     *     user_message: Message,
     *     assistant_message: Message|null,
     *     stream: StreamableAgentResponse|null,
     *     state: stdClass
     * }
     */
    public function startConversationStream(
        User $user,
        string $content,
        ?string $idempotencyKey = null,
    ): array {
        if ($idempotencyKey !== null) {
            $existingMessage = $this->findUserMessageByIdempotencyKey($user, $idempotencyKey);

            if ($existingMessage !== null) {
                if ($existingMessage->content !== $content) {
                    throw IdempotencyConflictException::reused();
                }

                $conversation = $existingMessage->conversation()->firstOrFail();

                return $this->prepareAssistantReplyStream($conversation, $user, $existingMessage);
            }
        }

        $this->messageModerationService->ensureAllowed($content);

        $conversation = $user->conversations()->create([
            'status' => 'active',
        ]);

        return $this->sendMessageStream(
            $conversation,
            $user,
            $content,
            moderated: true,
            idempotencyKey: $idempotencyKey,
        );
    }

    /**
     * @return array{
     *     conversation: Conversation,
     *     user_message: Message,
     *     assistant_message: Message|null,
     *     stream: StreamableAgentResponse|null,
     *     state: stdClass
     * }
     */
    public function sendMessageStream(
        Conversation $conversation,
        User $user,
        string $content,
        bool $moderated = false,
        ?string $idempotencyKey = null,
    ): array {
        if (! $moderated) {
            $this->messageModerationService->ensureAllowed($content);
        }

        Log::info('Chat stream message received.', [
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'content_length' => mb_strlen($content),
        ]);

        $userMessage = $this->persistUserMessage($conversation, $content, $idempotencyKey);

        return $this->prepareAssistantReplyStream($conversation, $user, $userMessage);
    }

    public function ensureTitleGenerated(Conversation|int $conversation): void
    {
        $conversation = $conversation instanceof Conversation
            ? $conversation->fresh()
            : Conversation::query()->find($conversation);

        if (! $conversation instanceof Conversation || filled($conversation->title)) {
            return;
        }

        $this->generateTitle($conversation);
    }

    /**
     * @return array{0: Message, 1: Message}
     */
    private function resumeOrSendAssistantReply(
        Conversation $conversation,
        User $user,
        Message $userMessage,
    ): array {
        $existingAssistant = $conversation->messages()
            ->where('role', 'assistant')
            ->where('reply_to_message_id', $userMessage->id)
            ->first();

        if ($existingAssistant !== null) {
            return [$userMessage, $existingAssistant];
        }

        $conversation->load(['messages' => fn ($query) => $query->orderBy('sequence')]);

        $retrieval = $this->knowledgeRetriever->retrieve($userMessage->content);

        if ($retrieval['enabled'] && ! $retrieval['in_context']) {
            $assistantMessage = $this->persistAssistantMessage(
                $conversation,
                $userMessage,
                $this->outOfContextResponse($retrieval),
            );

            return [$userMessage, $assistantMessage];
        }

        if ($this->shouldUseDirectContactResponse($retrieval, $userMessage->content)) {
            $assistantMessage = $this->persistAssistantMessage(
                $conversation,
                $userMessage,
                $this->directContactResponse($retrieval),
            );

            return [$userMessage, $assistantMessage];
        }

        $response = $this->aiRuntimeClient->respond(
            $conversation->id,
            $user->id,
            $this->buildModelContext($conversation, $userMessage),
            $retrieval['context'],
        );

        $response['metadata'] = $this->knowledgeMetadata($retrieval);

        $assistantMessage = $this->persistAssistantMessage($conversation, $userMessage, $response);

        return [$userMessage, $assistantMessage];
    }

    /**
     * @return array{
     *     conversation: Conversation,
     *     user_message: Message,
     *     assistant_message: Message|null,
     *     stream: StreamableAgentResponse|null,
     *     state: stdClass
     * }
     */
    private function prepareAssistantReplyStream(
        Conversation $conversation,
        User $user,
        Message $userMessage,
    ): array {
        $existingAssistant = $conversation->messages()
            ->where('role', 'assistant')
            ->where('reply_to_message_id', $userMessage->id)
            ->first();

        $state = new stdClass;
        $state->assistantMessage = $existingAssistant;

        if ($existingAssistant !== null) {
            return [
                'conversation' => $conversation,
                'user_message' => $userMessage,
                'assistant_message' => $existingAssistant,
                'stream' => null,
                'state' => $state,
            ];
        }

        $conversation->load(['messages' => fn ($query) => $query->orderBy('sequence')]);

        $retrieval = $this->knowledgeRetriever->retrieve($userMessage->content);

        if ($retrieval['enabled'] && ! $retrieval['in_context']) {
            $state->assistantMessage = $this->persistAssistantMessage(
                $conversation,
                $userMessage,
                $this->outOfContextResponse($retrieval),
            );

            return [
                'conversation' => $conversation,
                'user_message' => $userMessage,
                'assistant_message' => $state->assistantMessage,
                'stream' => null,
                'state' => $state,
            ];
        }

        if ($this->shouldUseDirectContactResponse($retrieval, $userMessage->content)) {
            $state->assistantMessage = $this->persistAssistantMessage(
                $conversation,
                $userMessage,
                $this->directContactResponse($retrieval),
            );

            return [
                'conversation' => $conversation,
                'user_message' => $userMessage,
                'assistant_message' => $state->assistantMessage,
                'stream' => null,
                'state' => $state,
            ];
        }

        $stream = $this->aiRuntimeClient->stream(
            $conversation->id,
            $user->id,
            $this->buildModelContext($conversation, $userMessage),
            $retrieval['context'],
        );

        $stream->then(function (StreamedAgentResponse $response) use ($conversation, $userMessage, $state, $retrieval): void {
            $state->assistantMessage = $this->persistAssistantMessage($conversation, $userMessage, [
                'message' => [
                    'role' => 'assistant',
                    'content' => $response->text,
                ],
                'usage' => $response->usage->toArray(),
                'model' => $response->meta->model,
                'metadata' => $this->knowledgeMetadata($retrieval),
            ]);

            Log::info('Chat stream response persisted.', [
                'conversation_id' => $conversation->id,
                'assistant_message_id' => $state->assistantMessage->id,
                'model' => data_get($state->assistantMessage->metadata, 'model'),
            ]);
        });

        return [
            'conversation' => $conversation,
            'user_message' => $userMessage,
            'assistant_message' => null,
            'stream' => $stream,
            'state' => $state,
        ];
    }

    private function persistUserMessage(
        Conversation $conversation,
        string $content,
        ?string $idempotencyKey = null,
    ): Message {
        return DB::transaction(function () use ($conversation, $content, $idempotencyKey): Message {
            $lockedConversation = Conversation::query()
                ->whereKey($conversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($idempotencyKey !== null) {
                $existingMessage = $lockedConversation->messages()
                    ->where('role', 'user')
                    ->where('metadata->idempotency_key', $idempotencyKey)
                    ->first();

                if ($existingMessage !== null) {
                    if ($existingMessage->content !== $content) {
                        throw IdempotencyConflictException::reused();
                    }

                    return $existingMessage;
                }
            }

            $nextSequence = (int) $lockedConversation->messages()->max('sequence') + 1;

            $message = $lockedConversation->messages()->create([
                'role' => 'user',
                'content' => $content,
                'sequence' => $nextSequence,
                'metadata' => array_filter([
                    'idempotency_key' => $idempotencyKey,
                ]),
            ]);

            $lockedConversation->forceFill([
                'last_message_at' => $message->created_at,
            ])->save();

            return $message;
        });
    }

    /**
     * @param  array<string, mixed>  $response
     */
    private function persistAssistantMessage(
        Conversation $conversation,
        Message $userMessage,
        array $response,
    ): Message {
        return DB::transaction(function () use ($conversation, $response, $userMessage): Message {
            $lockedConversation = Conversation::query()
                ->whereKey($conversation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $existingAssistant = $lockedConversation->messages()
                ->where('role', 'assistant')
                ->where('reply_to_message_id', $userMessage->id)
                ->first();

            if ($existingAssistant !== null) {
                return $existingAssistant;
            }

            $nextSequence = (int) $lockedConversation->messages()->max('sequence') + 1;

            $message = $lockedConversation->messages()->create([
                'role' => 'assistant',
                'reply_to_message_id' => $userMessage->id,
                'content' => (string) data_get($response, 'message.content', ''),
                'sequence' => $nextSequence,
                'metadata' => array_filter([
                    'usage' => data_get($response, 'usage'),
                    'model' => data_get($response, 'model'),
                    ...((array) data_get($response, 'metadata', [])),
                ], fn (mixed $value): bool => $value !== null),
            ]);

            $lockedConversation->forceFill([
                'last_message_at' => $message->created_at,
            ])->save();

            return $message;
        });
    }

    /**
     * @return array<int, array{role: string, content: string}>
     */
    private function buildModelContext(Conversation $conversation, ?Message $throughMessage = null): array
    {
        $maxMessages = (int) config('services.ai_chat.max_history_messages', 12);
        $maxCharacters = (int) config('services.ai_chat.max_history_characters', 12000);

        $messages = $conversation->messages
            ->when(
                $throughMessage !== null,
                fn ($collection) => $collection->where('sequence', '<=', $throughMessage->sequence),
            )
            ->sortByDesc('sequence')
            ->take($maxMessages)
            ->values();

        $selected = [];
        $totalCharacters = 0;

        foreach ($messages as $message) {
            $contentLength = mb_strlen($message->content);

            if ($totalCharacters > 0 && ($totalCharacters + $contentLength) > $maxCharacters) {
                continue;
            }

            if ($totalCharacters === 0 && $contentLength > $maxCharacters) {
                $selected[] = [
                    'role' => $message->role,
                    'content' => mb_substr($message->content, 0, $maxCharacters),
                ];

                break;
            }

            $selected[] = [
                'role' => $message->role,
                'content' => $message->content,
            ];
            $totalCharacters += $contentLength;
        }

        return array_reverse($selected);
    }

    private function generateTitle(Conversation $conversation): void
    {
        $messages = $conversation->fresh('messages')->messages
            ->sortBy('sequence')
            ->take(2)
            ->map(fn (Message $message): array => [
                'role' => $message->role,
                'content' => $message->content,
            ])
            ->values()
            ->all();

        if (count($messages) < 2) {
            return;
        }

        try {
            $title = $this->aiRuntimeClient->generateTitle($messages);
        } catch (\Throwable $exception) {
            Log::warning('Conversation title generation failed.', [
                'conversation_id' => $conversation->id,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return;
        }

        if (blank($title)) {
            return;
        }

        $conversation->forceFill([
            'title' => $title,
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $retrieval
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: null,
     *     model: null,
     *     metadata: array<string, mixed>
     * }
     */
    private function outOfContextResponse(array $retrieval): array
    {
        return [
            'message' => [
                'role' => 'assistant',
                'content' => (string) config('services.deka_knowledge.out_of_context_response'),
            ],
            'usage' => null,
            'model' => null,
            'metadata' => [
                'knowledge' => [
                    'enabled' => true,
                    'in_context' => false,
                    'sources' => $retrieval['sources'] ?? [],
                ],
                'out_of_context' => true,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $retrieval
     * @return array{
     *     message: array{role: string, content: string},
     *     usage: null,
     *     model: null,
     *     metadata: array<string, mixed>
     * }
     */
    private function directContactResponse(array $retrieval): array
    {
        $contact = $this->contactMetadata($retrieval);
        $mapsUrl = $contact['maps_url'] ?? null;
        $email = $contact['email'] ?? null;
        $phone = $contact['phone'] ?? null;
        $whatsapp = $contact['whatsapp'] ?? null;
        $lines = [
            'Berikut informasi kontak dan alamat Deka:',
        ];

        if ($mapsUrl !== null && $mapsUrl !== '') {
            $lines[] = "- Alamat: {$mapsUrl}";
        }

        if ($email !== null && $email !== '') {
            $lines[] = "- Email: {$email}";
        }

        if ($phone !== null && $phone !== '') {
            $lines[] = "- Telepon: {$phone}";
        }

        if ($whatsapp !== null && $whatsapp !== '') {
            $lines[] = "- WhatsApp: {$whatsapp}";
        }

        return [
            'message' => [
                'role' => 'assistant',
                'content' => implode("\n", $lines),
            ],
            'usage' => null,
            'model' => null,
            'metadata' => [
                ...$this->knowledgeMetadata($retrieval),
                'direct_response' => 'deka_contact',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $retrieval
     */
    private function shouldUseDirectContactResponse(array $retrieval, string $question): bool
    {
        if (! ($retrieval['enabled'] ?? false) || ! ($retrieval['in_context'] ?? false)) {
            return false;
        }

        $question = mb_strtolower($question);

        if (
            ! str_contains($question, 'kontak')
            && ! str_contains($question, 'alamat')
            && ! str_contains($question, 'lokasi')
            && ! str_contains($question, 'email')
            && ! str_contains($question, 'telepon')
            && ! str_contains($question, 'nomor')
            && ! str_contains($question, 'whatsapp')
            && ! str_contains($question, 'wa')
        ) {
            return false;
        }

        foreach ($retrieval['sources'] ?? [] as $source) {
            if (is_array($source) && ($source['url'] ?? null) === 'manual://deka/contact') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $retrieval
     * @return array{maps_url?: string|null, email?: string|null, phone?: string|null, whatsapp?: string|null}
     */
    private function contactMetadata(array $retrieval): array
    {
        foreach ($retrieval['sources'] ?? [] as $source) {
            if (! is_array($source) || ($source['url'] ?? null) !== 'manual://deka/contact') {
                continue;
            }

            $metadata = $source['metadata'] ?? [];

            return is_array($metadata) ? $metadata : [];
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $retrieval
     * @return array<string, mixed>
     */
    private function knowledgeMetadata(array $retrieval): array
    {
        if (! ($retrieval['enabled'] ?? false)) {
            return [];
        }

        return [
            'knowledge' => [
                'enabled' => true,
                'in_context' => (bool) ($retrieval['in_context'] ?? false),
                'sources' => $retrieval['sources'] ?? [],
            ],
        ];
    }

    private function isOutOfContextMessage(Message $message): bool
    {
        return (bool) data_get($message->metadata, 'out_of_context', false);
    }

    private function findUserMessageByIdempotencyKey(User $user, string $idempotencyKey): ?Message
    {
        return Message::query()
            ->where('role', 'user')
            ->where('metadata->idempotency_key', $idempotencyKey)
            ->whereHas('conversation', fn ($query) => $query->where('user_id', $user->id))
            ->orderByDesc('id')
            ->first();
    }
}
