<?php

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use Stringable;

class KnowledgeIntentPlannerAgent implements Agent, HasTools
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return 'You split a user question into Deka knowledge retrieval intents. '
            .'Return only valid JSON: an array of 1 to 4 objects with keys "intent", "question", and "queries". '
            .'Each "queries" value must be an array of 2 to 5 short search query strings. '
            .'Use intent names such as person_identity, company_team, company_address, company_services, company_products, company_projects, company_contact, company_profile, pricing, assistant_capability, or other_deka_fact. '
            .'Use company_team for questions about the team structure, employees, staff, members, roles, or a list of people working at DEKA. '
            .'If the user asks multiple Deka questions in one message, create one intent per question so no topic hides another. '
            .'Resolve likely typos and name variants from the supplied question and conversation context, but do not answer. Do not assume a specific person when more than one candidate is plausible. '
            .'If a person name is ambiguous, include queries for the likely candidates instead of choosing the answer. '
            .'For general non-Deka questions, return one object with intent "out_of_scope", the original question, and the original question as its only query.';
    }

    public function maxTokens(): int
    {
        return 260;
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
