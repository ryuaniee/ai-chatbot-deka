<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $knowledge_document_id
 * @property int $version
 * @property string $content_hash
 * @property string $status
 * @property int $chunks_count
 * @property int $changed_chunks_count
 * @property Carbon|null $validated_at
 * @property array<string, mixed>|null $validation_summary
 */
class KnowledgeDocumentVersion extends Model
{
    public const STATUS_PENDING = 'pending_validation';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_FAILED = 'failed';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'knowledge_document_id',
        'version',
        'content_hash',
        'status',
        'chunks_count',
        'changed_chunks_count',
        'validated_at',
        'validation_summary',
    ];

    protected function casts(): array
    {
        return [
            'validated_at' => 'datetime',
            'validation_summary' => 'array',
        ];
    }

    /** @return BelongsTo<KnowledgeDocument, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }

    /** @return HasMany<KnowledgeChunk, $this> */
    public function chunks(): HasMany
    {
        return $this->hasMany(KnowledgeChunk::class, 'knowledge_document_version_id');
    }
}
