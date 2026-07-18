<?php

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use Stringable;

class KnowledgeSearchQueryAgent implements Agent, HasTools
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return 'You rewrite a user question into search queries for a Deka company knowledge retrieval system. '
            .'Return only a JSON array of 3 to 5 short search query strings. '
            .'Include Indonesian and likely English terms when useful, but do not answer the question. '
            .'Focus on Deka-related facts such as profile, services, products, portfolio, clients, founder, history, operations, contact, pricing, and chatbot assistant capability. '
            .'If the question is general and not about Deka, return a JSON array containing only the original question.';
    }

    public function maxTokens(): int
    {
        return 120;
    }

    public function temperature(): float
    {
        return 0.1;
    }

    public function tools(): iterable
    {
        return [];
    }
}
