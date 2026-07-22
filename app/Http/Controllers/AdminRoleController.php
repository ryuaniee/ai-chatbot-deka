<?php

namespace App\Http\Controllers;

use App\Models\AdminActivityLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class AdminRoleController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validatedData($request);

        $role = Role::query()->create($validated + [
            'system' => false,
            'sort_order' => 100,
        ]);

        $this->log($request, 'Menambah role', $role, 'Admin menambahkan role '.$role->name.'.');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role berhasil ditambahkan.']);

        return back();
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $validated = $this->validatedData($request, $role);

        unset($validated['slug']);

        $role->update($validated);

        $this->log($request, 'Mengubah role', $role, 'Admin memperbarui role '.$role->name.'.');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role berhasil diperbarui.']);

        return back();
    }

    public function destroy(Request $request, Role $role): RedirectResponse
    {
        if ($role->system) {
            return back()->withErrors(['role' => 'Role bawaan tidak bisa dihapus.']);
        }

        if (User::query()->where('role', $role->slug)->exists()) {
            return back()->withErrors(['role' => 'Role masih dipakai pengguna. Pindahkan pengguna dulu.']);
        }

        $name = $role->name;

        $role->delete();

        $this->log($request, 'Menghapus role', $role, 'Admin menghapus role '.$name.'.');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Role berhasil dihapus.']);

        return back();
    }

    /**
     * @return array{slug: string, name: string, description: string|null, permissions: array<int, string>}
     */
    private function validatedData(Request $request, ?Role $role = null): array
    {
        $input = $request->all();
        $input['slug'] = Str::slug((string) ($input['slug'] ?? ''));
        $input['permissions'] = collect($input['permissions'] ?? [])
            ->map(static fn (mixed $permission): string => trim((string) $permission))
            ->filter(static fn (string $permission): bool => $permission !== '')
            ->unique(static fn (string $permission): string => mb_strtolower($permission))
            ->values()
            ->all();

        return validator($input, [
            'slug' => [
                'required',
                'string',
                'max:48',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('roles', 'slug')->ignore($role),
            ],
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['array', 'max:12'],
            'permissions.*' => ['string', 'max:60'],
        ])->validate();
    }

    private function log(Request $request, string $action, Role $role, string $description): void
    {
        $admin = $request->user();

        if (! $admin) {
            return;
        }

        AdminActivityLog::query()->create([
            'admin_user_id' => $admin->id,
            'category' => 'user',
            'action' => $action,
            'target_type' => Role::class,
            'target_id' => $role->id,
            'target' => $role->slug,
            'description' => $description,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ]);
    }
}
