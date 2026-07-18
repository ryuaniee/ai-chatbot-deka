<?php

namespace App\Http\Responses\Concerns;

use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Fortify\Fortify;

trait ResolvesAuthRedirect
{
    protected function redirectPathFor(Request $request, bool $withVerifiedFlag = false): string
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return Fortify::redirects('login');
        }

        if ($user->isAdmin()) {
            return $withVerifiedFlag ? '/admin?verified=1' : '/admin';
        }

        if (! $user->hasVerifiedEmail()) {
            return route('verification.notice', absolute: false);
        }

        return $withVerifiedFlag ? '/chat?verified=1' : '/chat';
    }
}
