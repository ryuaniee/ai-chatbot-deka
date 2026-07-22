<?php

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use Stringable;

class KnowledgeCandidateRerankerAgent implements Agent, HasTools
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return 'You select the most relevant Deka knowledge candidates for each user intent. '
            .'Return only valid JSON with keys "selected", "unanswered", and "notes". '
            .'The "selected" value must be an array of objects with keys "intent", "candidate_numbers", "confidence", and "guidance". '
            .'Select candidates independently per intent; do not let service/product candidates replace person identity candidates. '
            .'For misspelled person names, select the likely person only when the candidate clearly supports that match, and say in guidance to answer with "Jika yang dimaksud adalah ...". '
            .'If multiple people are similarly plausible, mark that intent unanswered with a clarification note instead of guessing. '
            .'For facts with caveats such as "perlu dikonfirmasi", keep the candidate selected and tell the answerer to include the caveat. '
            .'Never answer the user directly.';
    }

    public function maxTokens(): int
    {
        return 320;
    }

    public function temperature(): float
    {
        return 0.05;
    }

    public function tools(): iterable
    {
        return [];
    }
}
