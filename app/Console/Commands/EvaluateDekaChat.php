<?php

namespace App\Console\Commands;

use App\Services\Knowledge\DekaKnowledgeQueryNormalizer;
use App\Services\Knowledge\KnowledgeRetriever;
use Illuminate\Console\Command;
use RuntimeException;

class EvaluateDekaChat extends Command
{
    protected $signature = 'chat:eval
        {--dataset=tests/Fixtures/deka-chat-eval.json : JSON evaluation dataset}
        {--skip-retrieval : Evaluate query understanding without querying knowledge}
        {--fail-under=0.90 : Minimum passing ratio}';

    protected $description = 'Evaluate Deka typo, context resolution, and knowledge retrieval behavior.';

    public function handle(DekaKnowledgeQueryNormalizer $normalizer, KnowledgeRetriever $retriever): int
    {
        $path = base_path((string) $this->option('dataset'));
        $cases = json_decode((string) @file_get_contents($path), true);

        if (! is_array($cases) || $cases === []) {
            throw new RuntimeException("Evaluation dataset is missing or invalid: {$path}");
        }

        $queryPassed = 0;
        $retrievalPassed = 0;
        $retrievalMeasured = 0;
        $failures = [];

        foreach ($cases as $index => $case) {
            $result = $normalizer->normalize(
                (string) ($case['question'] ?? ''),
                is_array($case['history'] ?? null) ? $case['history'] : [],
            );
            $queryBlob = mb_strtolower(implode(' ', [$result['primary'], ...$result['alternates']]));
            $expectedTerms = array_map('mb_strtolower', $case['expected_query_terms'] ?? []);
            $queryOk = collect($expectedTerms)->every(
                static fn (string $term): bool => str_contains($queryBlob, $term),
            ) && (! array_key_exists('expected_ambiguous', $case)
                || (bool) $case['expected_ambiguous'] === $result['ambiguous']);

            if ($queryOk) {
                $queryPassed++;
            } else {
                $failures[] = sprintf('#%d query: %s', $index + 1, $case['question'] ?? '');
            }

            if ((bool) $this->option('skip-retrieval') || ! ($case['require_retrieval'] ?? false)) {
                continue;
            }

            $retrievalMeasured++;
            $retrieval = $retriever->retrieve($result['primary'], $result['alternates']);
            $context = mb_strtolower((string) $retrieval['context']);
            $retrievalOk = (bool) $retrieval['in_context']
                && collect(array_map('mb_strtolower', $case['expected_context_terms'] ?? []))
                    ->every(static fn (string $term): bool => str_contains($context, $term));

            if ($retrievalOk) {
                $retrievalPassed++;
            } else {
                $failures[] = sprintf('#%d retrieval: %s', $index + 1, $case['question'] ?? '');
            }
        }

        $queryRatio = $queryPassed / count($cases);
        $retrievalRatio = $retrievalMeasured > 0 ? $retrievalPassed / $retrievalMeasured : null;

        $this->table(['Metric', 'Passed', 'Total', 'Ratio'], [
            ['Query understanding', $queryPassed, count($cases), number_format($queryRatio * 100, 1).'%'],
            ['Knowledge retrieval', $retrievalPassed, $retrievalMeasured, $retrievalRatio === null ? 'not measured' : number_format($retrievalRatio * 100, 1).'%'],
        ]);

        foreach ($failures as $failure) {
            $this->warn($failure);
        }

        $threshold = max(0.0, min(1.0, (float) $this->option('fail-under')));

        return $queryRatio >= $threshold && ($retrievalRatio === null || $retrievalRatio >= $threshold)
            ? self::SUCCESS
            : self::FAILURE;
    }
}
