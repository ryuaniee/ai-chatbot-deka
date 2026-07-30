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
        return 'You create short conversation titles for a DEKA company chatbot. '
            .'Write the title in Indonesian, based on the actual topic of the user question (and assistant reply if available). '
            .'Make it specific and dynamic to the topic, for example: "Layanan utama DEKA", "Lokasi kantor DEKA", "Jam operasional DEKA", "Kontak resmi DEKA", "Apa itu DEKA". '
            .'Do not use generic titles like "Percakapan", "Chat", "New chat", "Halo", or "Pertanyaan user". '
            .'Keep it under 60 characters, title case-ish natural Indonesian, no quotes, no trailing punctuation. '
            .'Return only the title text.';
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
