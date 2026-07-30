<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\EmailAddress;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $name = (string) config('admin.seed.name', 'Admin Deka');
        $email = (string) config('admin.seed.email', 'admin@deka.dev');
        $password = (string) config('admin.seed.password', 'password');

        User::query()->updateOrCreate(
            ['canonical_email' => EmailAddress::canonical($email)],
            [
                'name' => $name,
                'email' => EmailAddress::normalize($email),
                'role' => User::ROLE_ADMIN,
                'email_verified_at' => now(),
                'password' => Hash::make($password),
            ],
        );
    }
}
