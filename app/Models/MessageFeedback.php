<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $message_id
 * @property int $user_id
 * @property string $type
 * @property string|null $reason
 * @property string $review_status
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class MessageFeedback extends Model
{
    public const TYPE_LIKE = 'like';

    public const TYPE_DISLIKE = 'dislike';

    public const REVIEW_STATUS_OPEN = 'open';

    public const REVIEW_STATUS_REVIEWING = 'reviewing';

    public const REVIEW_STATUS_RESOLVED = 'resolved';

    protected $table = 'message_feedback';

    protected $fillable = [
        'message_id',
        'user_id',
        'type',
        'reason',
        'review_status',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
