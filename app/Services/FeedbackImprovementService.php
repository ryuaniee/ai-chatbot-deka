<?php

namespace App\Services;

use App\Models\Message;
use App\Models\MessageFeedback;

class FeedbackImprovementService
{
    public function __construct(
        private readonly AiRuntimeClient $aiRuntimeClient,
    ) {}

    /**
     * @return array{improvement: string, metadata: array<string, mixed>}
     */
    public function generate(MessageFeedback $feedback): array
    {
        $feedback->loadMissing([
            'message:id,conversation_id,reply_to_message_id,role,sequence,content,metadata',
            'message.replyToMessage:id,conversation_id,role,sequence,content',
            'message.conversation:id,title',
            'message.conversation.messages:id,conversation_id,role,sequence,content',
            'user:id,name,email',
        ]);

        $message = $feedback->message;
        $question = $message?->replyToMessage->content ?: $this->nearestUserMessage($message);
        $context = $this->conversationContext($message);

        $response = $this->aiRuntimeClient->generateFeedbackImprovement([
            'user' => $feedback->user?->email,
            'conversation' => $message?->conversation?->title,
            'question' => $question ?: '-',
            'old_answer' => $message?->content ?: '-',
            'feedback_reason' => $feedback->reason ?: 'Tidak ada alasan tertulis.',
            'context' => $context,
        ]);

        return [
            'improvement' => trim($response['text']),
            'metadata' => [
                'model' => $response['model'],
                'usage' => $response['usage'],
            ],
        ];
    }

    private function nearestUserMessage(?Message $message): ?string
    {
        if ($message === null) {
            return null;
        }

        return $message->conversation
            ?->messages
            ->where('sequence', '<', $message->sequence)
            ->where('role', 'user')
            ->sortByDesc('sequence')
            ->first()
            ?->content;
    }

    private function conversationContext(?Message $message): string
    {
        if ($message === null) {
            return '-';
        }

        return $message->conversation
            ?->messages
            ->where('sequence', '<=', $message->sequence)
            ->sortByDesc('sequence')
            ->take(6)
            ->sortBy('sequence')
            ->map(static fn (Message $item): string => strtoupper($item->role).': '.$item->content)
            ->implode("\n\n") ?: '-';
    }
}
