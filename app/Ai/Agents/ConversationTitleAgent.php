<?php

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Messages\Message;
use Laravel\Ai\Promptable;
use Stringable;

class ConversationTitleAgent implements Agent, Conversational, HasTools
{
    use Promptable;

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function __construct(
        private readonly array $messages = [],
    ) {}

    public function instructions(): Stringable|string
    {
        return 'Create a short conversation title in the same language as the user. '
            .'Keep it under 80 characters. Return only the title text.';
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
