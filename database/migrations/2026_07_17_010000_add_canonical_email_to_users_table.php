<?php

use App\Support\EmailAddress;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('canonical_email')->nullable()->after('email');
        });

        DB::table('users')
            ->orderBy('id')
            ->select(['id', 'email'])
            ->chunk(100, function ($users): void {
                foreach ($users as $user) {
                    DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'email' => EmailAddress::normalize((string) $user->email),
                            'canonical_email' => EmailAddress::canonical((string) $user->email),
                        ]);
                }
            });

        DB::statement('ALTER TABLE users ALTER COLUMN canonical_email SET NOT NULL');

        Schema::table('users', function (Blueprint $table): void {
            $table->unique('canonical_email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['canonical_email']);
            $table->dropColumn('canonical_email');
        });
    }
};
