<?php

namespace App\Support;

use App\Models\Conversation;
use App\Models\Message;

class ChatResource
{
    /**
     * @return array<string, mixed>
     */
    public static function conversation(Conversation $conversation, bool $withMessages = false): array
    {
        $resource = [
            'id' => $conversation->id,
            'title' => $conversation->title,
            'status' => $conversation->status,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
            'created_at' => $conversation->created_at?->toISOString(),
            'updated_at' => $conversation->updated_at?->toISOString(),
        ];

        if ($withMessages) {
            $resource['messages'] = $conversation->messages
                ->sortBy('sequence')
                ->values()
                ->map(fn (Message $message): array => self::message($message))
                ->all();
        }

        return $resource;
    }

    /**
     * @return array<string, mixed>
     */
    public static function message(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'reply_to_message_id' => $message->reply_to_message_id,
            'role' => $message->role,
            'content' => $message->content,
            'sequence' => $message->sequence,
            'created_at' => $message->created_at?->toISOString(),
        ];
    }
}
