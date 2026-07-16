<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $knowledge_document_id
 * @property int $chunk_index
 * @property string $content
 * @property array<string, mixed>|null $metadata
 * @property KnowledgeDocument|null $document
 */
class KnowledgeChunk extends Model
{
    protected $fillable = [
        'knowledge_document_id',
        'chunk_index',
        'content',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
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
}
