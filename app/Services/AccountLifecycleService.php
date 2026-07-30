<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccountLifecycleService
{
    public function deletePermanently(
        User $user,
    ): void {
        DB::transaction(function () use ($user): void {
            $user->forceFill(['remember_token' => null])->save();
            $this->revokeSessions($user->id);
            $user->delete();
        });
    }

    private function revokeSessions(int $userId): void
    {
        DB::table('sessions')->where('user_id', $userId)->delete();
    }
}
