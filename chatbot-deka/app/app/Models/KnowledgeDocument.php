<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $url
 * @property string|null $title
 * @property string $content_hash
 * @property string $status
 * @property Carbon|null $crawled_at
 * @property array<string, mixed>|null $metadata
 */
class KnowledgeDocument extends Model
{
    protected $fillable = [
        'url',
        'title',
        'content_hash',
        'status',
        'crawled_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'crawled_at' => 'datetime',
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
}
