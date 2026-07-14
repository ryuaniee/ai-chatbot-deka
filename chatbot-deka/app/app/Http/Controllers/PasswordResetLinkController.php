<?php

namespace App\Http\Controllers;

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
        $email = strtolower(trim((string) $request->input(Fortify::username(), '')));
        $key = sprintf('password-reset-link:%s:%s', sha1($email), $request->ip());

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

        $status = Password::sendResetLink($request->only(Fortify::username()));

        if ($status !== Password::RESET_LINK_SENT) {
            return back()->withErrors([
                'email' => __($status),
            ]);
        }

        return back()->with('status', __($status));
    }
}
