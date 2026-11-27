<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\EmailAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Fortify;

class PasswordResetLinkController extends Controller
{
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $email = EmailAddress::normalize((string) $request->input(Fortify::username(), ''));
        $canonicalEmail = EmailAddress::canonical($email);
        $key = sprintf('password-reset-link:%s:%s', sha1($canonicalEmail), $request->ip());

        if (RateLimiter::tooManyAttempts($key, 3)) {
            $seconds = RateLimiter::availableIn($key);
            $message = sprintf(
                'Terlalu sering meminta email reset password. Coba lagi dalam %d menit.',
                max(1, (int) ceil($seconds / 60)),
            );

            if ($request->wantsJson()) {
                return response()->json([
                    'message' => $message,
                ], 429);
            }

            return back()->withErrors([
                'email' => $message,
            ]);
        }

        $request->merge([
            Fortify::username() => $email,
        ]);

        $request->validate([
            Fortify::username() => ['required', 'string', 'email'],
        ]);

        RateLimiter::hit($key, 600);

        $user = User::query()
            ->where('canonical_email', $canonicalEmail)
            ->first();

        if (! $user instanceof User) {
            return back()->with('status', __(Password::RESET_LINK_SENT));
        }

        $status = Password::sendResetLink([
            Fortify::username() => $user->email,
        ]);

        if ($status !== Password::RESET_LINK_SENT) {
            return back()->withErrors([
                'email' => __($status),
            ]);
        }

        return back()->with('status', __($status));
    }
}
