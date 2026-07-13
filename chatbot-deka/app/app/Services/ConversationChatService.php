<?php

namespace App\Services;

use App\Exceptions\IdempotencyConflictException;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ConversationChatService
{
    public function __construct(
        private readonly AiServiceClient $aiServiceClient,
        private readonly MessageModerationService $messageModerationService,
    ) {
    }

    /**
     * @return array{0: Conversation, 1: Message, 2: Message}
     */
    public function startConversation(
        User $user,
        string $content,
        ?string $idempotencyKey = null,
    ): array
    {
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
    ): array
    {
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

        $response = $this->aiServiceClient->respond(
            $conversation->id,
            $user->id,
            $this->buildModelContext($conversation),
        );

        $assistantMessage = DB::transaction(function () use ($conversation, $response, $userMessage): Message {
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

        return [$userMessage, $assistantMessage];
    }

    /**
     * @return array<int, array{role: string, content: string}>
     */
    private function buildModelContext(Conversation $conversation): array
    {
        $maxMessages = (int) config('services.ai_service.max_history_messages', 12);
        $maxCharacters = (int) config('services.ai_service.max_history_characters', 12000);

        $messages = $conversation->messages
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
            $title = $this->aiServiceClient->generateTitle($messages);
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
