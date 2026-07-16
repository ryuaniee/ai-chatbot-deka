<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int|null $reply_to_message_id
 * @property string $role
 * @property int $sequence
 * @property string $content
 * @property array<string, mixed>|null $metadata
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Message extends Model
{
    protected $fillable = [
        'conversation_id',
        'reply_to_message_id',
        'role',
        'sequence',
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
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function replyToMessage(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }
}
