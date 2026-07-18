<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use Stringable;

class MessageModerationAgent implements Agent, Conversational, HasStructuredOutput, HasTools
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return 'Classify whether the user message is allowed in a general assistant chat. '
            .'Block only content that clearly requests self-harm instructions, violent wrongdoing, '
            .'or dangerous illegal harm. '
            .'If allowed, return allowed=true and set reason_code and message to empty strings. '
            .'If blocked, return allowed=false, a short uppercase snake case reason_code, and a short user-facing message.';
    }

    public function messages(): iterable
    {
        return [];
    }

    public function tools(): iterable
    {
        return [];
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'allowed' => $schema->boolean()->required(),
            'reason_code' => $schema->string()->required(),
            'message' => $schema->string()->required(),
        ];
    }
}
