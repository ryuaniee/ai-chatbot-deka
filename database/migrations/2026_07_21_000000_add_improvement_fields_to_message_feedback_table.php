<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('message_feedback', function (Blueprint $table) {
            $table->string('admin_decision', 24)->nullable()->after('reviewed_at');
            $table->text('admin_note')->nullable()->after('admin_decision');
            $table->text('ai_improvement')->nullable()->after('admin_note');
            $table->json('ai_improvement_metadata')->nullable()->after('ai_improvement');
            $table->foreignIdFor(User::class, 'solved_by_user_id')
                ->nullable()
                ->after('ai_improvement_metadata')
                ->constrained('users')
                ->nullOnDelete();

            $table->index(['admin_decision', 'reviewed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('message_feedback', function (Blueprint $table) {
            $table->dropIndex(['admin_decision', 'reviewed_at']);
            $table->dropConstrainedForeignId('solved_by_user_id');
            $table->dropColumn([
                'admin_decision',
                'admin_note',
                'ai_improvement',
                'ai_improvement_metadata',
            ]);
        });
    }
};
