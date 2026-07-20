<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeChunk;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class KnowledgeRetriever
{
    public function __construct(
        private readonly KnowledgeEmbeddingService $embeddingService,
    ) {}

    /**
     * @param  array<int, string>  $alternateQueries
     * @return array{
     *     enabled: bool,
     *     in_context: bool,
     *     context: string,
     *     sources: array<int, array{id: int, document_id: int, source_uri: string, title: string|null, score: float}>
     * }
     */
    public function retrieve(string $query, array $alternateQueries = []): array
    {
        if (! (bool) config('services.deka_knowledge.enabled', false)) {
            return [
                'enabled' => false,
                'in_context' => true,
                'context' => '',
                'sources' => [],
            ];
        }

        $query = trim($query);

        if ($query === '') {
            return $this->emptyEnabledResult();
        }

        $chunks = $this->usesVectorRetrieval()
            ? $this->retrieveWithVector($query, $alternateQueries)
            : $this->retrieveWithFullText($query, $alternateQueries);

        if ($chunks === []) {
            return $this->emptyEnabledResult();
        }

        $context = collect($chunks)
            ->map(function (array $chunk, int $index): string {
                $candidateNumber = $index + 1;
                $title = $chunk['title'] ?: 'Deka Knowledge';
                $content = $this->excerpt($chunk['content']);

                return "[Candidate {$candidateNumber}]\n"
                    ."Title: {$title}\n"
                    ."URI: {$chunk['source_uri']}\n"
                    ."Score: {$chunk['score']}\n"
                    ."Content:\n{$content}";
            })
            ->implode("\n\n");

        $context = mb_substr($context, 0, (int) config('services.deka_knowledge.max_context_characters', 12000));

        return [
            'enabled' => true,
            'in_context' => true,
            'context' => $context,
            'sources' => array_map(
                static fn (array $chunk): array => [
                    'id' => $chunk['id'],
                    'document_id' => $chunk['document_id'],
                    'source_uri' => $chunk['source_uri'],
                    'title' => $chunk['title'],
                    'score' => $chunk['score'],
                ],
                $chunks,
            ),
        ];
    }

    /**
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithVector(string $query, array $alternateQueries = []): array
    {
        try {
            $queries = $this->candidateQueries($query, $alternateQueries);
            $embeddings = $this->embeddingService->embed($queries);
        } catch (Throwable $exception) {
            Log::warning('Knowledge retrieval embedding failed.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return [];
        }

        if ($embeddings === []) {
            return [];
        }

        $chunks = [];

        foreach ($embeddings as $embedding) {
            if (! is_array($embedding)) {
                continue;
            }

            $chunks = [
                ...$chunks,
                ...(DB::getDriverName() === 'pgsql'
                    ? $this->retrieveWithPgvector($embedding)
                    : $this->retrieveWithPhpCosine($embedding)),
            ];
        }

        return $this->rankUniqueChunks($chunks);
    }

    /**
     * @param  array<int, string>  $alternateQueries
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithFullText(string $query, array $alternateQueries = []): array
    {
        if (DB::getDriverName() !== 'pgsql') {
            return $this->retrieveWithLike($query, $alternateQueries);
        }

        $limit = $this->candidateLimit();
        $minScore = (float) config('services.deka_knowledge.min_fulltext_score', 0.01);
        $chunks = [];

        foreach ($this->candidateQueries($query, $alternateQueries) as $searchQuery) {
            $chunks = [
                ...$chunks,
                ...DB::table('knowledge_chunks')
                    ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
                    ->where('knowledge_documents.status', 'active')
                    ->select([
                        'knowledge_chunks.id',
                        'knowledge_chunks.knowledge_document_id as document_id',
                        'knowledge_documents.source_uri',
                        'knowledge_documents.title',
                        'knowledge_chunks.content',
                        'knowledge_chunks.chunk_index',
                    ])
                    ->selectRaw(
                        "ts_rank_cd(to_tsvector('simple', knowledge_chunks.content), websearch_to_tsquery('simple', ?)) as score",
                        [$searchQuery],
                    )
                    ->whereRaw(
                        "to_tsvector('simple', knowledge_chunks.content) @@ websearch_to_tsquery('simple', ?)",
                        [$searchQuery],
                    )
                    ->whereRaw(
                        "ts_rank_cd(to_tsvector('simple', knowledge_chunks.content), websearch_to_tsquery('simple', ?)) >= ?",
                        [$searchQuery, $minScore],
                    )
                    ->orderByDesc('score')
                    ->orderBy('knowledge_chunks.chunk_index')
                    ->limit($limit)
                    ->get()
                    ->map(static fn (object $row): array => [
                        'id' => (int) $row->id,
                        'document_id' => (int) $row->document_id,
                        'source_uri' => (string) $row->source_uri,
                        'title' => $row->title !== null ? (string) $row->title : null,
                        'content' => (string) $row->content,
                        'chunk_index' => (int) $row->chunk_index,
                        'score' => round((float) $row->score, 6),
                    ])
                    ->all(),
            ];
        }

        $chunks = $this->rankUniqueChunks($chunks);

        if ($chunks !== []) {
            return $this->expandCandidateWindows($chunks);
        }

        $chunks = [];

        foreach ($this->candidateQueries($query, $alternateQueries) as $searchQuery) {
            $terms = $this->normalizedSearchTerms($searchQuery);

            if ($terms === []) {
                continue;
            }

            $tsQuery = implode(' | ', $terms);

            $chunks = [
                ...$chunks,
                ...DB::table('knowledge_chunks')
                    ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
                    ->where('knowledge_documents.status', 'active')
                    ->select([
                        'knowledge_chunks.id',
                        'knowledge_chunks.knowledge_document_id as document_id',
                        'knowledge_documents.source_uri',
                        'knowledge_documents.title',
                        'knowledge_chunks.content',
                        'knowledge_chunks.chunk_index',
                    ])
                    ->selectRaw(
                        "ts_rank_cd(to_tsvector('simple', knowledge_chunks.content), to_tsquery('simple', ?)) as score",
                        [$tsQuery],
                    )
                    ->whereRaw(
                        "to_tsvector('simple', knowledge_chunks.content) @@ to_tsquery('simple', ?)",
                        [$tsQuery],
                    )
                    ->whereRaw(
                        "ts_rank_cd(to_tsvector('simple', knowledge_chunks.content), to_tsquery('simple', ?)) >= ?",
                        [$tsQuery, $minScore],
                    )
                    ->orderByDesc('score')
                    ->orderBy('knowledge_chunks.chunk_index')
                    ->limit($limit)
                    ->get()
                    ->map(static fn (object $row): array => [
                        'id' => (int) $row->id,
                        'document_id' => (int) $row->document_id,
                        'source_uri' => (string) $row->source_uri,
                        'title' => $row->title !== null ? (string) $row->title : null,
                        'content' => (string) $row->content,
                        'chunk_index' => (int) $row->chunk_index,
                        'score' => round((float) $row->score, 6),
                    ])
                    ->all(),
            ];
        }

        return $this->expandCandidateWindows($this->rankUniqueChunks($chunks));
    }

    /**
     * @param  array<int, string>  $alternateQueries
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithLike(string $query, array $alternateQueries = []): array
    {
        $terms = collect($this->candidateQueries($query, $alternateQueries))
            ->flatMap(fn (string $searchQuery): array => preg_split('/[^\pL\pN]+/u', mb_strtolower($searchQuery)) ?: [])
            ->filter(static fn (string $term): bool => mb_strlen($term) >= 3)
            ->unique()
            ->take(12)
            ->values();

        if ($terms->isEmpty()) {
            return [];
        }

        $chunks = KnowledgeChunk::query()
            ->with('document')
            ->whereHas('document', fn ($builder) => $builder->where('status', 'active'))
            ->where(function ($builder) use ($terms): void {
                foreach ($terms as $term) {
                    $builder->orWhereRaw('LOWER(content) LIKE ?', ['%'.$term.'%']);
                }
            })
            ->limit($this->candidateLimit())
            ->get()
            ->map(static fn (KnowledgeChunk $chunk): array => [
                'id' => $chunk->id,
                'document_id' => $chunk->knowledge_document_id,
                'source_uri' => (string) $chunk->document?->source_uri,
                'title' => $chunk->document?->title,
                'content' => $chunk->content,
                'chunk_index' => $chunk->chunk_index,
                'score' => 1.0,
            ])
            ->values()
            ->all();

        return $this->expandCandidateWindows($chunks);
    }

    /**
     * @return array<int, string>
     */
    private function candidateQueries(string $query, array $alternateQueries): array
    {
        return collect([$query, ...$alternateQueries])
            ->map(static fn (string $query): string => trim($query))
            ->filter(static fn (string $query): bool => $query !== '')
            ->unique(static fn (string $query): string => mb_strtolower($query))
            ->take((int) config('services.deka_knowledge.query_rewrite_limit', 5))
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, chunk_index?: int, score: float}>  $chunks
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, chunk_index?: int, score: float}>
     */
    private function rankUniqueChunks(array $chunks): array
    {
        return collect($chunks)
            ->sortByDesc('score')
            ->unique('id')
            ->take($this->candidateLimit())
            ->values()
            ->all();
    }

    /**
     * @param  array<int, float>  $embedding
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithPgvector(array $embedding): array
    {
        $limit = $this->candidateLimit();
        $minSimilarity = (float) config('services.deka_knowledge.min_similarity', 0.72);
        $vector = $this->vectorLiteral($embedding);

        return DB::table('knowledge_chunks')
            ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
            ->where('knowledge_documents.status', 'active')
            ->select([
                'knowledge_chunks.id',
                'knowledge_chunks.knowledge_document_id as document_id',
                'knowledge_documents.source_uri',
                'knowledge_documents.title',
                'knowledge_chunks.content',
            ])
            ->selectRaw('1 - (knowledge_chunks.embedding <=> ?::vector) as score', [$vector])
            ->whereRaw('1 - (knowledge_chunks.embedding <=> ?::vector) >= ?', [$vector, $minSimilarity])
            ->orderByRaw('knowledge_chunks.embedding <=> ?::vector', [$vector])
            ->limit($limit)
            ->get()
            ->map(static fn (object $row): array => [
                'id' => (int) $row->id,
                'document_id' => (int) $row->document_id,
                'source_uri' => (string) $row->source_uri,
                'title' => $row->title !== null ? (string) $row->title : null,
                'content' => (string) $row->content,
                'score' => round((float) $row->score, 6),
            ])
            ->all();
    }

    /**
     * @param  array<int, float>  $embedding
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithPhpCosine(array $embedding): array
    {
        $limit = $this->candidateLimit();
        $minSimilarity = (float) config('services.deka_knowledge.min_similarity', 0.72);

        return KnowledgeChunk::query()
            ->with('document')
            ->whereHas('document', fn ($query) => $query->where('status', 'active'))
            ->get()
            ->map(function (KnowledgeChunk $chunk) use ($embedding): array {
                $chunkEmbedding = is_array($chunk->embedding)
                    ? $chunk->embedding
                    : json_decode((string) $chunk->embedding, true, flags: JSON_THROW_ON_ERROR);

                return [
                    'id' => $chunk->id,
                    'document_id' => $chunk->knowledge_document_id,
                    'source_uri' => (string) $chunk->document?->source_uri,
                    'title' => $chunk->document?->title,
                    'content' => $chunk->content,
                    'score' => $this->cosineSimilarity($embedding, $chunkEmbedding),
                ];
            })
            ->filter(static fn (array $chunk): bool => $chunk['score'] >= $minSimilarity)
            ->sortByDesc('score')
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @return array{enabled: true, in_context: false, context: string, sources: array<int, array{id: int, document_id: int, source_uri: string, title: string|null, score: float}>}
     */
    private function emptyEnabledResult(): array
    {
        return [
            'enabled' => true,
            'in_context' => false,
            'context' => '',
            'sources' => [],
        ];
    }

    private function usesVectorRetrieval(): bool
    {
        return config('services.deka_knowledge.retrieval_mode', 'vector') === 'vector';
    }

    private function candidateLimit(): int
    {
        return max(1, (int) config('services.deka_knowledge.candidate_limit', 20));
    }

    /**
     * @param  array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, chunk_index?: int, score: float}>  $chunks
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function expandCandidateWindows(array $chunks): array
    {
        if ($chunks === []) {
            return [];
        }

        $limit = $this->candidateLimit();
        $expanded = [];
        $seen = [];

        foreach ($chunks as $chunk) {
            $this->addCandidate($expanded, $seen, $chunk);

            if (! isset($chunk['chunk_index'])) {
                continue;
            }

            $neighbors = KnowledgeChunk::query()
                ->with('document')
                ->where('knowledge_document_id', $chunk['document_id'])
                ->whereBetween('chunk_index', [$chunk['chunk_index'] - 2, $chunk['chunk_index'] + 2])
                ->orderBy('chunk_index')
                ->get();

            foreach ($neighbors as $neighbor) {
                $distance = abs($neighbor->chunk_index - $chunk['chunk_index']);

                $this->addCandidate($expanded, $seen, [
                    'id' => $neighbor->id,
                    'document_id' => $neighbor->knowledge_document_id,
                    'source_uri' => (string) $neighbor->document?->source_uri,
                    'title' => $neighbor->document?->title,
                    'content' => $neighbor->content,
                    'score' => round(max(0.000001, ((float) $chunk['score'] * 0.92) - ($distance * 0.01)), 6),
                ]);
            }

            if (count($expanded) >= ($limit * 2)) {
                break;
            }
        }

        return array_slice(array_values($expanded), 0, $limit);
    }

    /**
     * @param  array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>  $expanded
     * @param  array<int, true>  $seen
     * @param  array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}  $chunk
     */
    private function addCandidate(array &$expanded, array &$seen, array $chunk): void
    {
        if (isset($seen[$chunk['id']])) {
            return;
        }

        $seen[$chunk['id']] = true;
        $expanded[] = [
            'id' => $chunk['id'],
            'document_id' => $chunk['document_id'],
            'source_uri' => $chunk['source_uri'],
            'title' => $chunk['title'],
            'content' => $chunk['content'],
            'score' => $chunk['score'],
        ];
    }

    private function excerpt(string $content): string
    {
        $content = trim(preg_replace('/\s+/', ' ', $content) ?? $content);

        return mb_substr($content, 0, 900);
    }

    /**
     * @return array<int, string>
     */
    private function normalizedSearchTerms(string $query): array
    {
        $stopwords = [
            'apa',
            'itu',
            'ini',
            'dan',
            'atau',
            'yang',
            'untuk',
            'dengan',
            'dari',
            'siapa',
            'bagaimana',
            'kenapa',
            'mengapa',
            'dimana',
            'kapan',
        ];

        return collect(preg_split('/[^\pL\pN]+/u', mb_strtolower($query)) ?: [])
            ->map(static fn (string $term): string => trim($term))
            ->filter(static fn (string $term): bool => mb_strlen($term) >= 3 && ! in_array($term, $stopwords, true))
            ->map(static fn (string $term): string => preg_replace('/[^a-z0-9]+/i', '', $term) ?? '')
            ->filter(static fn (string $term): bool => $term !== '')
            ->take(8)
            ->values()
            ->all();
    }

    /**
     * @param  array<int, float>  $left
     * @param  array<int, float>  $right
     */
    private function cosineSimilarity(array $left, array $right): float
    {
        $dot = 0.0;
        $leftMagnitude = 0.0;
        $rightMagnitude = 0.0;
        $count = min(count($left), count($right));

        for ($index = 0; $index < $count; $index++) {
            $leftValue = (float) $left[$index];
            $rightValue = (float) $right[$index];
            $dot += $leftValue * $rightValue;
            $leftMagnitude += $leftValue * $leftValue;
            $rightMagnitude += $rightValue * $rightValue;
        }

        if ($leftMagnitude <= 0.0 || $rightMagnitude <= 0.0) {
            return 0.0;
        }

        return $dot / (sqrt($leftMagnitude) * sqrt($rightMagnitude));
    }

    /**
     * @param  array<int, float>  $embedding
     */
    private function vectorLiteral(array $embedding): string
    {
        return '['.implode(',', array_map(static fn (float|int $value): string => (string) $value, $embedding)).']';
    }
}
