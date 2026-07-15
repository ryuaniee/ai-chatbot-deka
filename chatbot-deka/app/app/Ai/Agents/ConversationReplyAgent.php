<?php

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Messages\Message;
use Laravel\Ai\Promptable;
use Stringable;

class ConversationReplyAgent implements Agent, Conversational, HasTools
{
    use Promptable;

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function __construct(
        private readonly array $messages = [],
        private readonly string $knowledgeContext = '',
    ) {}

    public function instructions(): Stringable|string
    {
        $instructions = 'You are Deka, a concise and helpful assistant. '
            .'Answer in Indonesian by default, in a direct and practical way. '
            .'Use short answers: 2-4 sentences for normal questions, bullets only when the user asks for details. '
            .'If information is missing, say so clearly instead of inventing details.';

        if (trim($this->knowledgeContext) === '') {
            return $instructions;
        }

        return $instructions."\n\n"
            ."Strict knowledge policy:\n"
            ."- Use only the DEKA_CONTEXT below to answer factual questions about Deka.\n"
            ."- Do not use outside knowledge for Deka facts.\n"
            ."- If the answer is not supported by DEKA_CONTEXT, say that the information is not available in Deka knowledge.\n"
            ."- Prefer the most direct fact from context; do not list products/services unless the user asks.\n"
            ."- Add one short source line only when it helps verify the answer.\n\n"
            ."DEKA_CONTEXT:\n"
            .$this->knowledgeContext;
    }

    public function maxTokens(): int
    {
        return (int) config('services.ai_chat.answer_max_tokens', 220);
    }

    public function temperature(): float
    {
        return (float) config('services.ai_chat.temperature', 0.2);
    }

    public function messages(): iterable
    {
        return array_map(
            static fn (array $message): Message => Message::tryFrom($message),
            $this->messages,
        );
    }

    public function tools(): iterable
    {
        return [];
    }
}
