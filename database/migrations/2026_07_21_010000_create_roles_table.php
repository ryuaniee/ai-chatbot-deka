<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 48)->unique();
            $table->string('name', 80);
            $table->text('description')->nullable();
            $table->json('permissions')->nullable();
            $table->boolean('system')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(100);
            $table->timestamps();
        });

        DB::table('roles')->insert([
            [
                'slug' => User::ROLE_ADMIN,
                'name' => 'Admin',
                'description' => 'Akses penuh untuk mengelola dashboard, pengguna, role, feedback, dan laporan aktivitas.',
                'permissions' => json_encode([
                    'Dashboard',
                    'Analytic',
                    'Review feedback',
                    'Kelola pengguna',
                    'Kelola roles',
                    'Log aktivitas',
                ], JSON_THROW_ON_ERROR),
                'system' => true,
                'sort_order' => 10,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'slug' => User::ROLE_USER,
                'name' => 'Pengguna',
                'description' => 'Akses percakapan chatbot dan riwayat milik akun sendiri.',
                'permissions' => json_encode([
                    'Chatbot',
                    'Riwayat chat',
                    'Profil akun',
                ], JSON_THROW_ON_ERROR),
                'system' => true,
                'sort_order' => 20,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
