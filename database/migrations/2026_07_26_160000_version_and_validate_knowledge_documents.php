<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('knowledge_document_id')->constrained('knowledge_documents')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('content_hash', 64);
            $table->string('status', 30)->default('pending_validation');
            $table->unsignedInteger('chunks_count')->default(0);
            $table->unsignedInteger('changed_chunks_count')->default(0);
            $table->timestamp('validated_at')->nullable();
            $table->json('validation_summary')->nullable();
            $table->timestamps();

            $table->unique(['knowledge_document_id', 'version']);
            $table->index(['knowledge_document_id', 'status']);
        });

        Schema::table('knowledge_chunks', function (Blueprint $table) {
            $table->dropUnique(['knowledge_document_id', 'chunk_index']);
            $table->foreignId('knowledge_document_version_id')
                ->nullable()
                ->after('knowledge_document_id')
                ->constrained('knowledge_document_versions')
                ->cascadeOnDelete();
        });

        $now = now();

        DB::table('knowledge_documents')->orderBy('id')->each(function (object $document) use ($now): void {
            $versionId = DB::table('knowledge_document_versions')->insertGetId([
                'knowledge_document_id' => $document->id,
                'version' => 1,
                'content_hash' => $document->content_hash,
                'status' => $document->status === 'active' ? 'active' : 'archived',
                'chunks_count' => DB::table('knowledge_chunks')->where('knowledge_document_id', $document->id)->count(),
                'changed_chunks_count' => 0,
                'validated_at' => $document->status === 'active' ? $now : null,
                'validation_summary' => json_encode(['migrated' => true], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('knowledge_chunks')
                ->where('knowledge_document_id', $document->id)
                ->update(['knowledge_document_version_id' => $versionId]);
        });

        Schema::table('knowledge_chunks', function (Blueprint $table) {
            $table->unique(['knowledge_document_version_id', 'chunk_index'], 'knowledge_chunks_version_index_unique');
            $table->index('knowledge_document_version_id');
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_chunks', function (Blueprint $table) {
            $table->dropUnique('knowledge_chunks_version_index_unique');
            $table->dropIndex(['knowledge_document_version_id']);
            $table->dropConstrainedForeignId('knowledge_document_version_id');
            $table->unique(['knowledge_document_id', 'chunk_index']);
        });

        Schema::dropIfExists('knowledge_document_versions');
    }
};
