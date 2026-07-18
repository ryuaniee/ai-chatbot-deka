<?php

namespace App\Http\Controllers;

use App\Actions\Fortify\CreateNewUser;
use App\Models\User;
use App\Support\EmailAddress;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;
use Symfony\Component\HttpFoundation\Response;

class AuthApiController extends Controller
{
    public function csrf(Request $request): JsonResponse
    {
        return response()->json([
            'csrf_token' => csrf_token(),
            'authenticated' => $request->user() !== null,
        ]);
    }

    public function register(Request $request, CreateNewUser $createNewUser): JsonResponse
    {
        if (! Features::enabled(Features::registration())) {
            abort(404);
        }

        $this->normalizeUsername($request);

        /** @var User $user */
        $user = $createNewUser->create($request->all());

        event(new Registered($user));

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Registration successful.',
            'user' => $this->userPayload($user),
            'redirect_to' => $this->redirectPathFor($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $this->normalizeUsername($request);

        $credentials = $request->validate([
            Fortify::username() => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $twoFactorResponse = $this->twoFactorChallengeResponse($request);

        if ($twoFactorResponse instanceof Response) {
            return response()->json([
                'message' => 'Two-factor challenge required.',
                'two_factor' => true,
                'redirect_to' => route('two-factor.login', absolute: false),
            ]);
        }

        $user = User::query()
            ->where('canonical_email', EmailAddress::canonical($credentials[Fortify::username()]))
            ->first();

        if (! $user instanceof User || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                Fortify::username() => [trans('auth.failed')],
            ]);
        }

        Auth::login($user, (bool) $request->boolean('remember'));

        $request->session()->regenerate();

        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'message' => 'Login successful.',
            'user' => $this->userPayload($user),
            'redirect_to' => $this->redirectPathFor($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
            'redirect_to' => $this->redirectPathFor($user),
        ]);
    }

    /**
     * @return array<string, bool|int|string|null>
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'requires_email_verification' => Features::enabled(Features::emailVerification())
                && $user->email_verified_at === null,
            'has_two_factor' => $user->two_factor_secret !== null,
        ];
    }

    private function redirectPathFor(User $user): string
    {
        return $user->isAdmin() ? '/admin' : '/chat';
    }

    private function normalizeUsername(Request $request): void
    {
        if (! config('fortify.lowercase_usernames') || ! $request->has(Fortify::username())) {
            return;
        }

        $request->merge([
            Fortify::username() => EmailAddress::normalize((string) $request->input(Fortify::username())),
        ]);
    }

    private function twoFactorChallengeResponse(Request $request): ?Response
    {
        if (! Features::enabled(Features::twoFactorAuthentication())) {
            return null;
        }

        $response = app(RedirectsIfTwoFactorAuthenticatable::class)->handle(
            $request,
            static fn (): null => null,
        );

        return $response instanceof Response ? $response : null;
    }
}
