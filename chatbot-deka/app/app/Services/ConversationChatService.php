<?php

namespace App\Services;

use App\Exceptions\IdempotencyConflictException;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
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

        if (blank($conversation->fresh()->title)) {
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

        $response = $this->aiRuntimeClient->respond(
            $conversation->id,
            $user->id,
            $this->buildModelContext($conversation, $userMessage),
        );

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

        $stream = $this->aiRuntimeClient->stream(
            $conversation->id,
            $user->id,
            $this->buildModelContext($conversation, $userMessage),
        );

        $stream->then(function (StreamedAgentResponse $response) use ($conversation, $userMessage, $state): void {
            $state->assistantMessage = $this->persistAssistantMessage($conversation, $userMessage, [
                'message' => [
                    'role' => 'assistant',
                    'content' => $response->text,
                ],
                'usage' => $response->usage->toArray(),
                'model' => $response->meta->model,
            ]);

            if (blank($conversation->fresh()->title)) {
                $this->generateTitle($conversation);
            }

            Log::info('Chat stream response persisted.', [
                'conversation_id' => $conversation->id,
                'assistant_message_id' => $state->assistantMessage?->id,
                'model' => data_get($state->assistantMessage?->metadata, 'model'),
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
