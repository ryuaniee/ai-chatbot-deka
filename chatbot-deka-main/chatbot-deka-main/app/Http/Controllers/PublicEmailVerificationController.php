<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PublicEmailVerificationController extends Controller
{
    public function __invoke(Request $request, int $id, string $hash): RedirectResponse
    {
        /** @var User|null $user */
        $user = User::query()->find($id);

        if ($user === null) {
            abort(404);
        }

        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            abort(403);
        }

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        $authenticatedUser = $request->user();

        if ($authenticatedUser instanceof User && $authenticatedUser->is($user)) {
            return redirect()->to($user->isAdmin() ? '/admin?verified=1' : '/chat?verified=1');
        }

        return redirect()
            ->route('login')
            ->with('status', 'Email berhasil diverifikasi. Silakan masuk untuk melanjutkan.');
    }
}
