<?php

namespace App\Http\Controllers;

use App\Http\Responses\Concerns\ResolvesAuthRedirect;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class VerificationNotificationController extends Controller
{
    use ResolvesAuthRedirect;

    public function store(Request $request): RedirectResponse|Response
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        if ($user->hasVerifiedEmail()) {
            return $request->wantsJson()
                ? response()->noContent()
                : redirect()->to($this->redirectPathFor($request));
        }

        $key = sprintf('verification-resend:%s:%s', $user->getAuthIdentifier(), $request->ip());

        if (RateLimiter::tooManyAttempts($key, 3)) {
            $seconds = RateLimiter::availableIn($key);
            $message = sprintf(
                'Terlalu sering mengirim ulang email verifikasi. Coba lagi dalam %d menit.',
                max(1, (int) ceil($seconds / 60)),
            );

            return $request->wantsJson()
                ? response()->json(['message' => $message], 429)
                : back()->withErrors(['verification' => $message]);
        }

        RateLimiter::hit($key, 600);

        $user->sendEmailVerificationNotification();

        return $request->wantsJson()
            ? response()->noContent(Response::HTTP_ACCEPTED)
            : back()->with('status', 'verification-link-sent');
    }
}
