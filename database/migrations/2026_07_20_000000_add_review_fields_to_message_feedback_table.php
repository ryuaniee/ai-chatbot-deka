<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('message_feedback', function (Blueprint $table) {
            $table->text('reason')->nullable()->after('type');
            $table->string('review_status', 24)->default('open')->after('reason');
            $table->timestamp('reviewed_at')->nullable()->after('review_status');

            $table->index(['review_status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('message_feedback', function (Blueprint $table) {
            $table->dropIndex(['review_status', 'created_at']);
            $table->dropColumn(['reason', 'review_status', 'reviewed_at']);
        });
    }
};
