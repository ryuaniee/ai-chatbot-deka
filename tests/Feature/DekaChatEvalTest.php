<?php

namespace Tests\Feature;

use Tests\TestCase;

class DekaChatEvalTest extends TestCase
{
    public function test_query_understanding_eval_meets_the_default_threshold(): void
    {
        $cases = json_decode(
            (string) file_get_contents(base_path('tests/Fixtures/deka-chat-eval.json')),
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        $this->assertGreaterThanOrEqual(30, count($cases));

        $this->artisan('chat:eval', ['--skip-retrieval' => true])
            ->assertSuccessful();
    }
}
