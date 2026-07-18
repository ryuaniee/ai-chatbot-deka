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
        $name = env('ADMIN_NAME', 'Admin Deka');
        $email = env('ADMIN_EMAIL', 'admin@deka.dev');
        $password = env('ADMIN_PASSWORD', 'password');

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
