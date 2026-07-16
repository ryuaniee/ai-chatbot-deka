<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeChunk;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DekaKnowledgeRetriever
{
    /**
     * @return array{
     *     enabled: bool,
     *     in_context: bool,
     *     context: string,
     *     sources: array<int, array{url: string, title: string|null, score: float, metadata?: array<string, mixed>|null}>
     * }
     */
    public function retrieve(string $query): array
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

        $chunks = DB::getDriverName() === 'pgsql'
            ? $this->retrieveWithPostgresFullText($query)
            : $this->retrieveWithLike($query);

        if ($chunks === []) {
            return $this->emptyEnabledResult();
        }

        $context = collect($chunks)
            ->map(function (array $chunk, int $index): string {
                $sourceNumber = $index + 1;
                $title = $chunk['title'] ?: 'Deka';

                return "[Source {$sourceNumber}] {$title}\nURL: {$chunk['url']}\n{$chunk['content']}";
            })
            ->implode("\n\n");
        $context = mb_substr($context, 0, (int) config('services.deka_knowledge.max_context_characters', 2400));

        return [
            'enabled' => true,
            'in_context' => true,
            'context' => $context,
            'sources' => array_map(
                static fn (array $chunk): array => [
                    'url' => $chunk['url'],
                    'title' => $chunk['title'],
                    'score' => $chunk['score'],
                    'metadata' => $chunk['metadata'] ?? null,
                ],
                $chunks,
            ),
        ];
    }

    /**
     * @return array<int, array{url: string, title: string|null, content: string, score: float, metadata?: array<string, mixed>|null}>
     */
    private function retrieveWithPostgresFullText(string $query): array
    {
        $topK = (int) config('services.deka_knowledge.top_k', 3);
        $minScore = (float) config('services.deka_knowledge.min_score', 0.02);
        $terms = $this->normalizedSearchTerms($query);
        $searchQuery = implode(' ', $terms);

        if ($searchQuery === 'deka') {
            return $this->retrieveIntroChunks($topK);
        }

        $tsQuery = implode(' | ', $terms);

        return KnowledgeChunk::query()
            ->select('knowledge_chunks.*')
            ->selectRaw('knowledge_documents.url AS source_url, knowledge_documents.title AS source_title')
            ->selectRaw(
                "ts_rank_cd(to_tsvector('simple', knowledge_chunks.content), to_tsquery('simple', ?)) AS relevance",
                [$tsQuery],
            )
            ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
            ->where('knowledge_documents.status', 'active')
            ->whereRaw("to_tsvector('simple', knowledge_chunks.content) @@ to_tsquery('simple', ?)", [$tsQuery])
            ->orderByDesc('relevance')
            ->orderBy('knowledge_chunks.chunk_index')
            ->limit($topK)
            ->get()
            ->filter(fn (KnowledgeChunk $chunk): bool => (float) $chunk->getAttribute('relevance') >= $minScore)
            ->map(fn (KnowledgeChunk $chunk): array => [
                'url' => (string) $chunk->getAttribute('source_url'),
                'title' => $chunk->getAttribute('source_title'),
                'content' => $chunk->content,
                'score' => (float) $chunk->getAttribute('relevance'),
                'metadata' => $chunk->metadata,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{url: string, title: string|null, content: string, score: float, metadata?: array<string, mixed>|null}>
     */
    private function retrieveIntroChunks(int $topK): array
    {
        return KnowledgeChunk::query()
            ->select('knowledge_chunks.*')
            ->selectRaw('knowledge_documents.url AS source_url, knowledge_documents.title AS source_title')
            ->join('knowledge_documents', 'knowledge_documents.id', '=', 'knowledge_chunks.knowledge_document_id')
            ->where('knowledge_documents.status', 'active')
            ->orderBy('knowledge_documents.id')
            ->orderBy('knowledge_chunks.chunk_index')
            ->limit($topK)
            ->get()
            ->map(fn (KnowledgeChunk $chunk): array => [
                'url' => (string) $chunk->getAttribute('source_url'),
                'title' => $chunk->getAttribute('source_title'),
                'content' => $chunk->content,
                'score' => 1.0,
                'metadata' => $chunk->metadata,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{url: string, title: string|null, content: string, score: float, metadata?: array<string, mixed>|null}>
     */
    private function retrieveWithLike(string $query): array
    {
        $terms = collect(preg_split('/\s+/u', Str::lower($query)) ?: [])
            ->filter(fn (string $term): bool => mb_strlen($term) >= 3)
            ->take(5)
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
            ->limit((int) config('services.deka_knowledge.top_k', 3))
            ->get();

        return $chunks
            ->map(fn (KnowledgeChunk $chunk): array => [
                'url' => (string) $chunk->document?->url,
                'title' => $chunk->document?->title,
                'content' => $chunk->content,
                'score' => 1.0,
                'metadata' => $chunk->metadata,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{enabled: true, in_context: false, context: string, sources: array<int, array{url: string, title: string|null, score: float, metadata?: array<string, mixed>|null}>}
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

        $terms = collect(preg_split('/[^\pL\pN]+/u', Str::lower($query)) ?: [])
            ->map(fn (string $term): string => trim($term))
            ->filter(fn (string $term): bool => mb_strlen($term) >= 3 && ! in_array($term, $stopwords, true))
            ->take(8)
            ->values()
            ->all();

        return $terms !== [] ? $terms : [$query];
    }
}
