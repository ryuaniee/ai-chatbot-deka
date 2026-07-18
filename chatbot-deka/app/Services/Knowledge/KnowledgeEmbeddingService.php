<?php

namespace App\Services\Knowledge;

use Laravel\Ai\Embeddings;

class KnowledgeEmbeddingService
{
    /**
     * @param  array<int, string>  $inputs
     * @return array<int, array<int, float>>
     */
    public function embed(array $inputs): array
    {
        $inputs = array_values(array_filter(
            array_map(static fn (string $input): string => trim($input), $inputs),
            static fn (string $input): bool => $input !== '',
        ));

        if ($inputs === []) {
            return [];
        }

        $response = Embeddings::for($inputs)
            ->dimensions($this->dimensions())
            ->timeout((int) config('services.deka_knowledge.embedding_timeout', 45))
            ->cache((int) config('services.deka_knowledge.embedding_cache_seconds', 60 * 60 * 24 * 30))
            ->generate($this->provider(), $this->model());

        return $response->embeddings;
    }

    public function provider(): string
    {
        return trim((string) config('services.deka_knowledge.embedding_provider', 'openai')) ?: 'openai';
    }

    public function model(): string
    {
        return trim((string) config('services.deka_knowledge.embedding_model', 'text-embedding-3-small'))
            ?: 'text-embedding-3-small';
    }

    public function dimensions(): int
    {
        return (int) config('services.deka_knowledge.embedding_dimensions', 1536);
    }
}
