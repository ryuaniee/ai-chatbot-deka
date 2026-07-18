<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeDocument;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class KnowledgeIngestor
{
    public function __construct(
        private readonly KnowledgeChunker $chunker,
        private readonly KnowledgeEmbeddingService $embeddingService,
    ) {}

    /**
     * @param  array<string, mixed>  $metadata
     * @return array{document_id: int, chunks_stored: int}
     */
    public function ingestText(
        string $sourceType,
        string $sourceUri,
        string $content,
        ?string $title = null,
        ?string $canonicalUri = null,
        array $metadata = [],
    ): array {
        $content = trim($content);

        if (mb_strlen($content) < (int) config('services.deka_knowledge.min_document_characters', 80)) {
            throw new RuntimeException('Knowledge content is too short to ingest.');
        }

        $chunks = $this->chunker->chunk($content);

        if ($chunks === []) {
            throw new RuntimeException('Knowledge content did not produce any chunks.');
        }

        $embeddings = $this->usesVectorRetrieval()
            ? $this->embeddingService->embed($chunks)
            : array_fill(0, count($chunks), $this->emptyEmbedding());

        if (count($embeddings) !== count($chunks)) {
            throw new RuntimeException('Embedding provider returned an unexpected number of vectors.');
        }

        return DB::transaction(function () use (
            $sourceType,
            $sourceUri,
            $content,
            $title,
            $canonicalUri,
            $metadata,
            $chunks,
            $embeddings,
        ): array {
            $document = KnowledgeDocument::query()->updateOrCreate(
                ['source_uri' => $sourceUri],
                [
                    'source_type' => $sourceType,
                    'canonical_uri' => $canonicalUri,
                    'title' => $title,
                    'content_hash' => hash('sha256', $content),
                    'status' => 'active',
                    'language' => $metadata['language'] ?? null,
                    'last_ingested_at' => now(),
                    'metadata' => $metadata + ['content_length' => mb_strlen($content)],
                ],
            );

            $document->chunks()->delete();

            foreach ($chunks as $index => $chunk) {
                $this->insertChunk($document->id, $index, $chunk, $embeddings[$index]);
            }

            return [
                'document_id' => $document->id,
                'chunks_stored' => count($chunks),
            ];
        });
    }

    /**
     * @param  array<int, float>  $embedding
     */
    private function insertChunk(int $documentId, int $index, string $content, array $embedding): void
    {
        $values = [
            'knowledge_document_id' => $documentId,
            'chunk_index' => $index,
            'content' => $content,
            'content_hash' => hash('sha256', $content),
            'token_count' => $this->chunker->estimateTokens($content),
            'embedding_provider' => $this->usesVectorRetrieval() ? $this->embeddingService->provider() : 'none',
            'embedding_model' => $this->usesVectorRetrieval() ? $this->embeddingService->model() : 'fulltext',
            'metadata' => json_encode(['content_length' => mb_strlen($content)], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (DB::getDriverName() !== 'pgsql') {
            DB::table('knowledge_chunks')->insert($values + [
                'embedding' => json_encode($embedding, JSON_THROW_ON_ERROR),
            ]);

            return;
        }

        DB::statement(
            'INSERT INTO knowledge_chunks (
                knowledge_document_id, chunk_index, content, content_hash, token_count,
                embedding_provider, embedding_model, embedding, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::vector, ?::json, ?, ?)',
            [
                $values['knowledge_document_id'],
                $values['chunk_index'],
                $values['content'],
                $values['content_hash'],
                $values['token_count'],
                $values['embedding_provider'],
                $values['embedding_model'],
                $this->vectorLiteral($embedding),
                $values['metadata'],
                $values['created_at'],
                $values['updated_at'],
            ],
        );
    }

    /**
     * @param  array<int, float>  $embedding
     */
    private function vectorLiteral(array $embedding): string
    {
        return '['.implode(',', array_map(static fn (float|int $value): string => (string) $value, $embedding)).']';
    }

    private function usesVectorRetrieval(): bool
    {
        return config('services.deka_knowledge.retrieval_mode', 'vector') === 'vector';
    }

    /**
     * @return array<int, float>
     */
    private function emptyEmbedding(): array
    {
        return array_fill(0, (int) config('services.deka_knowledge.embedding_dimensions', 1536), 0.0);
    }
}
