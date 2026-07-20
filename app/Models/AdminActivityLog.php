<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $admin_user_id
 * @property string $category
 * @property string $action
 * @property string|null $target_type
 * @property int|null $target_id
 * @property string $target
 * @property string|null $description
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class AdminActivityLog extends Model
{
    protected $fillable = [
        'admin_user_id',
        'category',
        'action',
        'target_type',
        'target_id',
        'target',
        'description',
        'ip_address',
        'user_agent',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
