<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $source_type
 * @property string $source_uri
 * @property string|null $canonical_uri
 * @property string|null $title
 * @property string $content_hash
 * @property string $status
 * @property string|null $language
 * @property Carbon|null $last_ingested_at
 * @property array<string, mixed>|null $metadata
 * @property Collection<int, KnowledgeDocumentVersion> $versions
 * @property KnowledgeDocumentVersion|null $activeVersion
 */
class KnowledgeDocument extends Model
{
    protected $fillable = [
        'source_type',
        'source_uri',
        'canonical_uri',
        'title',
        'content_hash',
        'status',
        'language',
        'last_ingested_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'last_ingested_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /**
     * @return HasMany<KnowledgeChunk, $this>
     */
    public function chunks(): HasMany
    {
        return $this->hasMany(KnowledgeChunk::class);
    }

    /** @return HasMany<KnowledgeDocumentVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(KnowledgeDocumentVersion::class);
    }

    /** @return HasOne<KnowledgeDocumentVersion, $this> */
    public function activeVersion(): HasOne
    {
        return $this->hasOne(KnowledgeDocumentVersion::class)->where('status', KnowledgeDocumentVersion::STATUS_ACTIVE);
    }
}
