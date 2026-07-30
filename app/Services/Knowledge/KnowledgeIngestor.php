<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeDocument;
use App\Models\KnowledgeDocumentVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class KnowledgeIngestor
{
    public function __construct(
        private readonly KnowledgeChunker $chunker,
        private readonly KnowledgeEmbeddingService $embeddingService,
        private readonly KnowledgeIngestionValidator $validator,
    ) {}

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
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

        $contentHash = hash('sha256', $content);
        $existing = KnowledgeDocument::query()->where('source_uri', $sourceUri)->first();

        $needsEmbeddingRefresh = $existing !== null
            && $this->usesVectorRetrieval()
            && $existing->activeVersion?->chunks()->where('embedding_provider', 'none')->exists();

        if ($existing !== null && hash_equals($existing->content_hash, $contentHash) && ! $needsEmbeddingRefresh) {
            $existing->forceFill([
                'source_type' => $sourceType,
                'canonical_uri' => $canonicalUri,
                'title' => $title,
                'status' => 'active',
                'language' => $metadata['language'] ?? $existing->language,
                'last_ingested_at' => now(),
                'metadata' => $metadata + [
                    'content_length' => mb_strlen($content),
                    'source_priority' => $this->sourcePriority($sourceType, $metadata),
                ],
            ])->save();

            return [
                'document_id' => $existing->id,
                'version_id' => $existing->activeVersion?->id,
                'version' => $existing->activeVersion?->version,
                'status' => 'unchanged',
                'chunks_stored' => $existing->activeVersion?->chunks()->count() ?? 0,
                'changed_chunks' => 0,
                'validation' => $existing->activeVersion?->validation_summary,
            ];
        }

        $chunks = $this->chunker->chunk($content);

        if ($chunks === []) {
            throw new RuntimeException('Knowledge content did not produce any chunks.');
        }

        $activeChunks = $existing?->activeVersion?->chunks()
            ->get(['content_hash', 'embedding_provider', 'embedding_model', 'embedding'])
            ->keyBy('content_hash') ?? collect();
        $activeHashes = $activeChunks->keys()->all();
        $changedChunkIndexes = collect($chunks)
            ->keys()
            ->filter(fn (int $index): bool => ! in_array(hash('sha256', $chunks[$index]), $activeHashes, true))
            ->values()
            ->all();
        $embeddings = array_fill(0, count($chunks), $this->emptyEmbedding());
        $hasEmbeddings = array_fill(0, count($chunks), false);
        $embeddingIndexes = [];

        if ($this->usesVectorRetrieval()) {
            foreach ($chunks as $index => $chunk) {
                $oldChunk = $activeChunks->get(hash('sha256', $chunk));

                if (
                    $oldChunk !== null
                    && $oldChunk->embedding_provider === $this->embeddingService->provider()
                    && $oldChunk->embedding_model === $this->embeddingService->model()
                ) {
                    $embeddings[$index] = $this->storedEmbedding($oldChunk->embedding);
                    $hasEmbeddings[$index] = true;
                } else {
                    $embeddingIndexes[] = $index;
                }
            }
        }

        try {
            $newEmbeddings = $embeddingIndexes !== []
                ? $this->embeddingService->embed(array_map(fn (int $index): string => $chunks[$index], $embeddingIndexes))
                : [];

            if (count($newEmbeddings) !== count($embeddingIndexes)) {
                throw new RuntimeException('Embedding provider returned an unexpected number of vectors.');
            }

            foreach ($embeddingIndexes as $position => $index) {
                $embeddings[$index] = $newEmbeddings[$position];
                $hasEmbeddings[$index] = true;
            }
        } catch (Throwable $exception) {
            if ($this->retrievalMode() !== 'hybrid') {
                throw $exception;
            }

            Log::warning('Knowledge embedding failed during hybrid ingestion; storing full-text chunks.', [
                'source_uri' => $sourceUri,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);
        }

        $pending = DB::transaction(function () use (
            $sourceType,
            $sourceUri,
            $content,
            $title,
            $canonicalUri,
            $metadata,
            $chunks,
            $embeddings,
            $contentHash,
            $hasEmbeddings,
            $changedChunkIndexes,
        ): KnowledgeDocumentVersion {
            $document = KnowledgeDocument::query()->firstOrCreate(
                ['source_uri' => $sourceUri],
                [
                    'source_type' => $sourceType,
                    'canonical_uri' => $canonicalUri,
                    'title' => $title,
                    'content_hash' => $contentHash,
                    'status' => KnowledgeDocumentVersion::STATUS_PENDING,
                    'language' => $metadata['language'] ?? null,
                    'last_ingested_at' => now(),
                    'metadata' => $metadata + [
                        'content_length' => mb_strlen($content),
                        'source_priority' => $this->sourcePriority($sourceType, $metadata),
                    ],
                ],
            );

            $document->forceFill([
                'source_type' => $sourceType,
                'canonical_uri' => $canonicalUri,
                'title' => $title,
                'language' => $metadata['language'] ?? $document->language,
                'last_ingested_at' => now(),
                'metadata' => $metadata + [
                    'content_length' => mb_strlen($content),
                    'source_priority' => $this->sourcePriority($sourceType, $metadata),
                ],
            ])->save();

            $nextVersion = ((int) $document->versions()->max('version')) + 1;
            $version = $document->versions()->create([
                'version' => $nextVersion,
                'content_hash' => $contentHash,
                'status' => KnowledgeDocumentVersion::STATUS_PENDING,
                'chunks_count' => count($chunks),
                'changed_chunks_count' => count($changedChunkIndexes),
            ]);

            foreach ($chunks as $index => $chunk) {
                $this->insertChunk($document->id, $version->id, $index, $chunk, $embeddings[$index], $hasEmbeddings[$index]);
            }

            return $version->fresh(['document']);
        });

        $validationEnabled = (bool) config('services.deka_knowledge.validation_enabled', false);
        $validation = $validationEnabled && $changedChunkIndexes !== []
            ? $this->validator->validate($pending, $changedChunkIndexes)
            : [
                'passed' => true,
                'probes_total' => 0,
                'probes_passed' => 0,
                'cases' => [],
                'error' => null,
                'skipped' => true,
            ];

        DB::transaction(function () use ($pending, $validation, $contentHash): void {
            $document = KnowledgeDocument::query()->lockForUpdate()->findOrFail($pending->knowledge_document_id);

            if ($validation['passed']) {
                $document->versions()
                    ->where('status', KnowledgeDocumentVersion::STATUS_ACTIVE)
                    ->update(['status' => KnowledgeDocumentVersion::STATUS_ARCHIVED]);
                $pending->forceFill([
                    'status' => KnowledgeDocumentVersion::STATUS_ACTIVE,
                    'validated_at' => now(),
                    'validation_summary' => $validation,
                ])->save();
                $document->forceFill([
                    'content_hash' => $contentHash,
                    'status' => KnowledgeDocumentVersion::STATUS_ACTIVE,
                ])->save();
                FuzzyTypoCorrector::flushVocabularyCache();

                return;
            }

            $pending->forceFill([
                'status' => KnowledgeDocumentVersion::STATUS_FAILED,
                'validated_at' => now(),
                'validation_summary' => $validation,
            ])->save();
            $document->forceFill([
                'status' => $document->versions()->where('status', KnowledgeDocumentVersion::STATUS_ACTIVE)->exists()
                    ? KnowledgeDocumentVersion::STATUS_ACTIVE
                    : KnowledgeDocumentVersion::STATUS_FAILED,
            ])->save();
        });

        return [
            'document_id' => $pending->knowledge_document_id,
            'version_id' => $pending->id,
            'version' => $pending->version,
            'status' => $validation['passed'] ? KnowledgeDocumentVersion::STATUS_ACTIVE : KnowledgeDocumentVersion::STATUS_FAILED,
            'chunks_stored' => count($chunks),
            'changed_chunks' => count($changedChunkIndexes),
            'validation' => $validation,
        ];
    }

    /**
     * @param  array<int, float>  $embedding
     */
    private function insertChunk(int $documentId, int $versionId, int $index, string $content, array $embedding, bool $hasEmbedding): void
    {
        $values = [
            'knowledge_document_id' => $documentId,
            'knowledge_document_version_id' => $versionId,
            'chunk_index' => $index,
            'content' => $content,
            'content_hash' => hash('sha256', $content),
            'token_count' => $this->chunker->estimateTokens($content),
            'embedding_provider' => $hasEmbedding ? $this->embeddingService->provider() : 'none',
            'embedding_model' => $hasEmbedding ? $this->embeddingService->model() : 'fulltext',
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
                knowledge_document_id, knowledge_document_version_id, chunk_index, content, content_hash, token_count,
                embedding_provider, embedding_model, embedding, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::vector, ?::json, ?, ?)',
            [
                $values['knowledge_document_id'],
                $values['knowledge_document_version_id'],
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

    /**
     * @return array<int, float>
     */
    private function storedEmbedding(mixed $embedding): array
    {
        if (is_array($embedding)) {
            return array_map('floatval', $embedding);
        }

        $literal = trim((string) $embedding, "[] \t\n\r\0\x0B");

        return $literal === ''
            ? $this->emptyEmbedding()
            : array_map('floatval', explode(',', $literal));
    }

    private function usesVectorRetrieval(): bool
    {
        return in_array(
            strtolower((string) config('services.deka_knowledge.retrieval_mode', 'fulltext')),
            ['vector', 'hybrid'],
            true,
        );
    }

    private function retrievalMode(): string
    {
        return strtolower((string) config('services.deka_knowledge.retrieval_mode', 'fulltext'));
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function sourcePriority(string $sourceType, array $metadata): int
    {
        $configured = $metadata['source_priority'] ?? null;

        if (is_numeric($configured)) {
            return max(0, min(1000, (int) $configured));
        }

        return $sourceType === 'file' ? 100 : 50;
    }

    /**
     * @return array<int, float>
     */
    private function emptyEmbedding(): array
    {
        return array_fill(0, (int) config('services.deka_knowledge.embedding_dimensions', 1536), 0.0);
    }
}
