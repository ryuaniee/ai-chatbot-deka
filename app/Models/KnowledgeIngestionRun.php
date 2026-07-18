<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $source_type
 * @property string $source_uri
 * @property string $status
 * @property int $pages_seen
 * @property int $documents_stored
 * @property int $chunks_stored
 * @property string|null $error_message
 * @property Carbon $started_at
 * @property Carbon|null $finished_at
 * @property array<string, mixed>|null $metadata
 */
class KnowledgeIngestionRun extends Model
{
    protected $fillable = [
        'source_type',
        'source_uri',
        'status',
        'pages_seen',
        'documents_stored',
        'chunks_stored',
        'error_message',
        'started_at',
        'finished_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
