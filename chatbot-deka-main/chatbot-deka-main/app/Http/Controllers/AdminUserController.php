<?php

namespace App\Http\Controllers;

use App\Models\AdminActivityLog;
use App\Models\User;
use App\Services\AccountLifecycleService;
use App\Support\EmailAddress;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class AdminUserController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatedData($request, true);

        $user = User::query()->create($validated);

        $this->log($request, 'Menambah pengguna', $user, 'Admin menambahkan pengguna '.$user->email.'.');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengguna berhasil ditambahkan.']);

        return back();
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $this->validatedData($request, false, $user);

        if ($user->isAdmin() && $validated['role'] !== User::ROLE_ADMIN && $this->adminCount() <= 1) {
            return back()->withErrors(['role' => 'Minimal harus ada satu admin aktif.']);
        }

        if (($validated['password'] ?? '') === '') {
            unset($validated['password']);
        }

        $user->update($validated);

        $this->log($request, 'Mengubah pengguna', $user, 'Admin memperbarui pengguna '.$user->email.'.');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengguna berhasil diperbarui.']);

        return back();
    }

    public function destroy(Request $request, User $user, AccountLifecycleService $lifecycle): RedirectResponse
    {
        if ($request->user()?->is($user)) {
            return back()->withErrors(['user' => 'Admin tidak bisa menghapus akunnya sendiri.']);
        }

        if ($user->isAdmin() && $this->adminCount() <= 1) {
            return back()->withErrors(['user' => 'Minimal harus ada satu admin aktif.']);
        }

        $email = $user->email;

        $lifecycle->deletePermanently($user);

        $this->log($request, 'Menghapus pengguna', $user, 'Admin menghapus pengguna '.$email.'.');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengguna berhasil dihapus.']);

        return back();
    }

    /**
     * @return array{name: string, email: string, canonical_email: string, role: string, email_verified_at: CarbonInterface|null, password?: string}
     */
    private function validatedData(Request $request, bool $creating, ?User $user = null): array
    {
        $input = $request->all();

        if (isset($input['email'])) {
            $input['email'] = EmailAddress::normalize((string) $input['email']);
            $input['canonical_email'] = EmailAddress::canonical((string) $input['email']);
        }

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user),
            ],
            'canonical_email' => [
                'required',
                'string',
                'max:255',
                Rule::unique('users', 'canonical_email')->ignore($user),
            ],
            'role' => ['required', Rule::exists('roles', 'slug')],
            'email_verified' => ['required', 'boolean'],
            'password' => [$creating ? 'required' : 'nullable', 'string', Password::default(), 'confirmed'],
        ];

        $validated = validator($input, $rules)->validate();
        $emailVerified = (bool) $validated['email_verified'];

        $emailVerifiedAt = $emailVerified
            ? ($user !== null ? ($user->email_verified_at ?? now()) : now())
            : null;

        $result = [
            'name' => (string) $validated['name'],
            'email' => (string) $validated['email'],
            'canonical_email' => (string) $validated['canonical_email'],
            'role' => (string) $validated['role'],
            'email_verified_at' => $emailVerifiedAt,
        ];

        if (array_key_exists('password', $validated)) {
            $result['password'] = (string) $validated['password'];
        }

        return $result;
    }

    private function adminCount(): int
    {
        return User::query()->where('role', User::ROLE_ADMIN)->count();
    }

    private function log(Request $request, string $action, User $user, string $description): void
    {
        $admin = $request->user();

        if (! $admin) {
            return;
        }

        AdminActivityLog::query()->create([
            'admin_user_id' => $admin->id,
            'category' => 'user',
            'action' => $action,
            'target_type' => User::class,
            'target_id' => $user->id,
            'target' => $user->email,
            'description' => $description,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ]);
    }
}
