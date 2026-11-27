<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $knowledge_document_id
 * @property int $chunk_index
 * @property string $content
 * @property string $content_hash
 * @property int $token_count
 * @property string $embedding_provider
 * @property string $embedding_model
 * @property array<int, float>|string $embedding
 * @property array<string, mixed>|null $metadata
 */
class KnowledgeChunk extends Model
{
    protected $fillable = [
        'knowledge_document_id',
        'knowledge_document_version_id',
        'chunk_index',
        'content',
        'content_hash',
        'token_count',
        'embedding_provider',
        'embedding_model',
        'embedding',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'embedding' => 'array',
            'metadata' => 'array',
        ];
    }

    /**
     * @return BelongsTo<KnowledgeDocument, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }

    /** @return BelongsTo<KnowledgeDocumentVersion, $this> */
    public function version(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocumentVersion::class, 'knowledge_document_version_id');
    }
}
