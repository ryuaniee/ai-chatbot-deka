<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $base_url
 * @property string $status
 * @property int $pages_seen
 * @property int $pages_stored
 * @property int $chunks_stored
 * @property string|null $error_message
 * @property Carbon $started_at
 * @property Carbon|null $finished_at
 * @property array<string, mixed>|null $metadata
 */
class KnowledgeIngestionRun extends Model
{
    protected $fillable = [
        'base_url',
        'status',
        'pages_seen',
        'pages_stored',
        'chunks_stored',
        'error_message',
        'started_at',
        'finished_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'pages_seen' => 'integer',
            'pages_stored' => 'integer',
            'chunks_stored' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
