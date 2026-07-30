<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeDocumentVersion;
use App\Services\AiRuntimeClient;
use RuntimeException;
use Throwable;

class KnowledgeIngestionValidator
{
    public function __construct(
        private readonly KnowledgeRetriever $retriever,
        private readonly AiRuntimeClient $aiRuntimeClient,
        private readonly DekaKnowledgeQueryNormalizer $queryNormalizer,
    ) {}

    /**
     * @param  array<int, int>  $changedChunkIndexes
     * @return array{passed: bool, probes_total: int, probes_passed: int, cases: array<int, array<string, mixed>>, error: string|null}
     */
    public function validate(KnowledgeDocumentVersion $version, array $changedChunkIndexes): array
    {
        $probeCount = max(1, (int) config('services.deka_knowledge.validation_probe_count', 3));
        $cases = [];

        try {
            $chunks = $version->chunks()
                ->whereIn('chunk_index', $changedChunkIndexes)
                ->orderBy('chunk_index')
                ->get();

            foreach ($chunks as $chunk) {
                $probes = $this->aiRuntimeClient->generateKnowledgeValidationProbes($chunk->content, $probeCount);

                if (count($probes) !== $probeCount) {
                    throw new RuntimeException("Chunk {$chunk->chunk_index} did not produce {$probeCount} valid probes.");
                }

                foreach ($probes as $probe) {
                    $normalized = $this->queryNormalizer->normalize($probe['question']);
                    $rewritten = (bool) config('services.deka_knowledge.query_rewrite_enabled', true)
                        ? $this->aiRuntimeClient->rewriteKnowledgeQueries($probe['question'])
                        : [];
                    $queries = collect([
                        $normalized['primary'],
                        ...$rewritten,
                        ...$normalized['alternates'],
                        $probe['question'],
                    ])->filter()->unique(static fn (string $query): string => mb_strtolower($query))->values();
                    $retrieval = $this->retriever->retrieve(
                        (string) $queries->first(),
                        $queries->slice(1)->all(),
                        ['version_ids' => [$version->id]],
                    );
                    $retrievedExpectedChunk = collect($retrieval['sources'])
                        ->contains(fn (array $source): bool => (int) $source['id'] === $chunk->id);
                    $answer = '';
                    $judge = [
                        'grounded' => false,
                        'complete' => false,
                        'contradiction' => true,
                        'reason' => 'Expected chunk was not retrieved.',
                    ];

                    if ($retrievedExpectedChunk) {
                        $response = $this->aiRuntimeClient->respond(0, 0, [
                            [
                                'role' => 'assistant',
                                'content' => "DEKA_KNOWLEDGE_CANDIDATES_UNTRUSTED_DATA:\nBEGIN_DEKA_CANDIDATES\n"
                                    .$retrieval['context']."\nEND_DEKA_CANDIDATES",
                            ],
                            ['role' => 'user', 'content' => $probe['question']],
                        ]);
                        $answer = trim((string) data_get($response, 'message.content', ''));
                        $judge = $this->aiRuntimeClient->judgeKnowledgeValidationAnswer(
                            $probe['question'],
                            $probe['required_facts'],
                            $chunk->content,
                            $answer,
                        );
                    }

                    $passed = $retrievedExpectedChunk
                        && $answer !== ''
                        && $judge['grounded']
                        && $judge['complete']
                        && ! $judge['contradiction'];

                    $cases[] = [
                        'chunk_index' => $chunk->chunk_index,
                        'question' => $probe['question'],
                        'required_facts' => $probe['required_facts'],
                        'retrieved_expected_chunk' => $retrievedExpectedChunk,
                        'source_ids' => array_column($retrieval['sources'], 'id'),
                        'answer' => $answer,
                        'judge' => $judge,
                        'passed' => $passed,
                    ];
                }
            }
        } catch (Throwable $exception) {
            return [
                'passed' => false,
                'probes_total' => count($cases),
                'probes_passed' => collect($cases)->where('passed', true)->count(),
                'cases' => $cases,
                'error' => $exception->getMessage(),
            ];
        }

        $passedCount = collect($cases)->where('passed', true)->count();

        return [
            'passed' => $cases !== [] && $passedCount === count($cases),
            'probes_total' => count($cases),
            'probes_passed' => $passedCount,
            'cases' => $cases,
            'error' => null,
        ];
    }
}
