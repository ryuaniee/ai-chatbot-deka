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
 * @property string|null $admin_decision
 * @property string|null $admin_note
 * @property string|null $ai_improvement
 * @property array<string, mixed>|null $ai_improvement_metadata
 * @property int|null $solved_by_user_id
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

    public const REVIEW_STATUS_IGNORED = 'ignored';

    public const ADMIN_DECISION_SOLVE = 'solve';

    public const ADMIN_DECISION_IGNORE = 'ignore';

    protected $table = 'message_feedback';

    protected $fillable = [
        'message_id',
        'user_id',
        'type',
        'reason',
        'review_status',
        'reviewed_at',
        'admin_decision',
        'admin_note',
        'ai_improvement',
        'ai_improvement_metadata',
        'solved_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'ai_improvement_metadata' => 'array',
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
