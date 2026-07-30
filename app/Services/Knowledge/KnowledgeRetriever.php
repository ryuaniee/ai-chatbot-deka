<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeChunk;
use App\Models\KnowledgeDocument;
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
     * @param  array{version_ids?: array<int, int|string>}  $options
     * @return array{
     *     enabled: bool,
     *     in_context: bool,
     *     context: string,
     *     sources: array<int, array<string, mixed>>,
     *     diagnostics: array<string, mixed>
     * }
     */
    public function retrieve(string $query, array $alternateQueries = [], array $options = []): array
    {
        if (! (bool) config('services.deka_knowledge.enabled', false)) {
            return [
                'enabled' => false,
                'in_context' => true,
                'context' => '',
                'sources' => [],
                'diagnostics' => ['configured_mode' => $this->retrievalMode(), 'used_modes' => []],
            ];
        }

        $query = trim($query);

        if ($query === '') {
            return $this->emptyEnabledResult();
        }

        $startedAt = microtime(true);
        $mode = $this->retrievalMode();
        $versionIds = collect($options['version_ids'] ?? [])
            ->map(static fn (int|string $id): int => (int) $id)
            ->filter()
            ->all();
        $fullTextChunks = [];
        $vectorChunks = [];

        if (in_array($mode, ['fulltext', 'hybrid'], true)) {
            $fullTextChunks = $this->retrieveWithFullText($query, $alternateQueries, $versionIds);
        }

        if ($mode === 'vector' || ($mode === 'hybrid' && $this->hasUsableEmbeddings($versionIds))) {
            $vectorChunks = $this->retrieveWithVector($query, $alternateQueries, $versionIds);
        }

        $chunks = $mode === 'hybrid'
            ? $this->fuseRankings($fullTextChunks, $vectorChunks)
            : ($mode === 'vector' ? $vectorChunks : $fullTextChunks);
        $chunks = $this->applySourcePriority($chunks);

        $diagnostics = [
            'configured_mode' => $mode,
            'used_modes' => array_values(array_filter([
                $fullTextChunks !== [] ? 'fulltext' : null,
                $vectorChunks !== [] ? 'vector' : null,
            ])),
            'fulltext_candidates' => count($fullTextChunks),
            'vector_candidates' => count($vectorChunks),
            'duration_ms' => round((microtime(true) - $startedAt) * 1000, 2),
        ];

        if ($chunks === []) {
            return $this->emptyEnabledResult($diagnostics);
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
                    ."Source priority: {$chunk['source_priority']}\n"
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
                    'source_priority' => $chunk['source_priority'],
                    'retrieval_modes' => $chunk['retrieval_modes'] ?? [],
                ],
                $chunks,
            ),
            'diagnostics' => $diagnostics,
        ];
    }

    /**
     * @param  array<int, string>  $alternateQueries
     * @param  array<int, int>  $versionIds
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithVector(string $query, array $alternateQueries = [], array $versionIds = []): array
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
            $chunks = [
                ...$chunks,
                ...(DB::getDriverName() === 'pgsql'
                    ? $this->retrieveWithPgvector($embedding, $versionIds)
                    : $this->retrieveWithPhpCosine($embedding, $versionIds)),
            ];
        }

        return $this->rankUniqueChunks($chunks);
    }

    /**
     * @param  array<int, string>  $alternateQueries
     * @param  array<int, int>  $versionIds
     * @return array<int, array<string, mixed>>
     */
    private function retrieveWithFullText(string $query, array $alternateQueries = [], array $versionIds = []): array
    {
        if (DB::getDriverName() !== 'pgsql') {
            return $this->retrieveWithLike($query, $alternateQueries, $versionIds);
        }

        $limit = $this->candidateLimit();
        $minScore = (float) config('services.deka_knowledge.min_fulltext_score', 0.01);
        $rankings = [];

        foreach ($this->candidateQueries($query, $alternateQueries) as $searchQuery) {
            $ranking = DB::table('knowledge_chunks')
                ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
                ->join('knowledge_document_versions', 'knowledge_document_versions.id', '=', 'knowledge_chunks.knowledge_document_version_id')
                ->when(
                    $versionIds !== [],
                    fn ($builder) => $builder->whereIn('knowledge_document_versions.id', $versionIds),
                    fn ($builder) => $builder->where('knowledge_document_versions.status', 'active'),
                )
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
                ->all();

            if ($ranking === []) {
                $terms = $this->normalizedSearchTerms($searchQuery);

                if ($terms === []) {
                    continue;
                }

                $tsQuery = implode(' | ', $terms);
                $ranking = DB::table('knowledge_chunks')
                    ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
                    ->join('knowledge_document_versions', 'knowledge_document_versions.id', '=', 'knowledge_chunks.knowledge_document_version_id')
                    ->when(
                        $versionIds !== [],
                        fn ($builder) => $builder->whereIn('knowledge_document_versions.id', $versionIds),
                        fn ($builder) => $builder->where('knowledge_document_versions.status', 'active'),
                    )
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
                    ->all();
            }

            if ($ranking !== []) {
                $rankings[] = $ranking;
            }
        }

        return $this->fuseQueryRankings($rankings);
    }

    /**
     * PostgreSQL text ranks are not comparable across different query shapes.
     * Reciprocal-rank fusion keeps broad rewrites from drowning out exact facts.
     *
     * @param  array<int, array<int, array<string, mixed>>>  $rankings
     * @return array<int, array<string, mixed>>
     */
    private function fuseQueryRankings(array $rankings): array
    {
        $fused = [];

        foreach ($rankings as $ranking) {
            foreach ($ranking as $index => $chunk) {
                $id = (int) $chunk['id'];

                if (! isset($fused[$id])) {
                    $fused[$id] = $chunk;
                    $fused[$id]['score'] = 0.0;
                }

                $fused[$id]['score'] += 1 / (60 + $index + 1);
            }
        }

        $ranked = collect($fused)
            ->map(function (array $chunk): array {
                $chunk['score'] = round((float) $chunk['score'], 6);

                return $chunk;
            })
            ->sortByDesc('score');
        $reserved = collect($rankings)
            ->flatMap(fn (array $ranking, int $index): array => array_slice($ranking, 0, $index === 0 ? 2 : 1))
            ->unique('id')
            ->take($this->candidateLimit())
            ->map(function (array $chunk) use ($ranked): array {
                $chunk = $ranked->firstWhere('id', $chunk['id']) ?? $chunk;
                $chunk['score'] = round((float) $chunk['score'] + 1.0, 6);

                return $chunk;
            });

        return $reserved
            ->concat($ranked)
            ->unique('id')
            ->take($this->candidateLimit())
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $alternateQueries
     * @param  array<int, int>  $versionIds
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithLike(string $query, array $alternateQueries = [], array $versionIds = []): array
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
            ->when(
                $versionIds !== [],
                fn ($builder) => $builder->whereIn('knowledge_document_version_id', $versionIds),
                fn ($builder) => $builder->whereHas('version', fn ($version) => $version->where('status', 'active')),
            )
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

        return $this->rankUniqueChunks($chunks);
    }

    /**
     * @param  array<int, string>  $alternateQueries
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
     * @param  array<int, int>  $versionIds
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithPgvector(array $embedding, array $versionIds = []): array
    {
        $limit = $this->candidateLimit();
        $minSimilarity = (float) config('services.deka_knowledge.min_similarity', 0.72);
        $vector = $this->vectorLiteral($embedding);

        return DB::table('knowledge_chunks')
            ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
            ->join('knowledge_document_versions', 'knowledge_document_versions.id', '=', 'knowledge_chunks.knowledge_document_version_id')
            ->when(
                $versionIds !== [],
                fn ($builder) => $builder->whereIn('knowledge_document_versions.id', $versionIds),
                fn ($builder) => $builder->where('knowledge_document_versions.status', 'active'),
            )
            ->where('knowledge_chunks.embedding_provider', '!=', 'none')
            ->where('knowledge_chunks.embedding_model', '!=', 'fulltext')
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
     * @param  array<int, int>  $versionIds
     * @return array<int, array{id: int, document_id: int, source_uri: string, title: string|null, content: string, score: float}>
     */
    private function retrieveWithPhpCosine(array $embedding, array $versionIds = []): array
    {
        $limit = $this->candidateLimit();
        $minSimilarity = (float) config('services.deka_knowledge.min_similarity', 0.72);

        return KnowledgeChunk::query()
            ->with('document')
            ->when(
                $versionIds !== [],
                fn ($query) => $query->whereIn('knowledge_document_version_id', $versionIds),
                fn ($query) => $query->whereHas('version', fn ($version) => $version->where('status', 'active')),
            )
            ->where('embedding_provider', '!=', 'none')
            ->where('embedding_model', '!=', 'fulltext')
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
     * @param  array<string, mixed>  $diagnostics
     * @return array{enabled: true, in_context: false, context: string, sources: array<int, array<string, mixed>>, diagnostics: array<string, mixed>}
     */
    private function emptyEnabledResult(array $diagnostics = []): array
    {
        return [
            'enabled' => true,
            'in_context' => false,
            'context' => '',
            'sources' => [],
            'diagnostics' => $diagnostics + ['configured_mode' => $this->retrievalMode(), 'used_modes' => []],
        ];
    }

    private function retrievalMode(): string
    {
        $mode = strtolower((string) config('services.deka_knowledge.retrieval_mode', 'fulltext'));

        return in_array($mode, ['fulltext', 'vector', 'hybrid'], true) ? $mode : 'fulltext';
    }

    /**
     * @param  array<int, int>  $versionIds
     */
    private function hasUsableEmbeddings(array $versionIds = []): bool
    {
        try {
            return KnowledgeChunk::query()
                ->when(
                    $versionIds !== [],
                    fn ($query) => $query->whereIn('knowledge_document_version_id', $versionIds),
                    fn ($query) => $query->whereHas('version', fn ($version) => $version->where('status', 'active')),
                )
                ->where('embedding_provider', '!=', 'none')
                ->where('embedding_model', '!=', 'fulltext')
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Reciprocal-rank fusion keeps lexical and semantic scores comparable.
     *
     * @param  array<int, array<string, mixed>>  $fullText
     * @param  array<int, array<string, mixed>>  $vector
     * @return array<int, array<string, mixed>>
     */
    private function fuseRankings(array $fullText, array $vector): array
    {
        $fused = [];

        foreach (['fulltext' => $fullText, 'vector' => $vector] as $retrievalMode => $ranking) {
            foreach ($ranking as $index => $chunk) {
                $id = (int) $chunk['id'];

                if (! isset($fused[$id])) {
                    $fused[$id] = $chunk + ['retrieval_modes' => []];
                    $fused[$id]['score'] = 0.0;
                }

                $fused[$id]['score'] += 1 / (60 + $index + 1);
                $fused[$id]['retrieval_modes'][] = $retrievalMode;
            }
        }

        return collect($fused)
            ->map(function (array $chunk): array {
                $chunk['score'] = round((float) $chunk['score'], 6);
                $chunk['retrieval_modes'] = array_values(array_unique($chunk['retrieval_modes']));

                return $chunk;
            })
            ->sortByDesc('score')
            ->take($this->candidateLimit())
            ->values()
            ->all();
    }

    /**
     * Curated files outrank crawled pages when otherwise similarly relevant.
     *
     * @param  array<int, array<string, mixed>>  $chunks
     * @return array<int, array<string, mixed>>
     */
    private function applySourcePriority(array $chunks): array
    {
        if ($chunks === []) {
            return [];
        }

        $documents = KnowledgeDocument::query()
            ->whereIn('id', collect($chunks)->pluck('document_id')->unique()->all())
            ->get()
            ->keyBy('id');

        return collect($chunks)
            ->map(function (array $chunk) use ($documents): array {
                $document = $documents->get($chunk['document_id']);
                $configured = data_get($document?->metadata, 'source_priority');
                $priority = is_numeric($configured)
                    ? (int) $configured
                    : ($document->source_type === 'file' ? 100 : 50);

                $chunk['source_priority'] = max(0, min(1000, $priority));

                return $chunk;
            })
            ->sortByDesc(fn (array $chunk): float => (float) $chunk['score'] + ($chunk['source_priority'] / 10000))
            ->take($this->candidateLimit())
            ->values()
            ->all();
    }

    private function candidateLimit(): int
    {
        return max(1, (int) config('services.deka_knowledge.candidate_limit', 20));
    }

    private function excerpt(string $content): string
    {
        $content = trim(preg_replace('/\s+/', ' ', $content) ?? $content);

        $limit = max(1200, (int) config('services.deka_knowledge.chunk_size', 1200) + 200);

        return mb_substr($content, 0, $limit);
    }

    /**
     * @return array<int, string>
     */
    private function normalizedSearchTerms(string $query): array
    {
        $stopwords = [
            'apa',
            'aja',
            'saja',
            'itu',
            'ini',
            'di',
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
            'ngapain',
            'deka',
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
