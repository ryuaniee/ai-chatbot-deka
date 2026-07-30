<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\EmailAddress;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $email = 'user@gmail.com';

        User::query()->updateOrCreate(
            ['canonical_email' => EmailAddress::canonical($email)],
            [
                'name' => 'Default User',
                'email' => $email,
                'role' => User::ROLE_USER,
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ],
        );
    }
}
