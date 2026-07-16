<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_documents', function (Blueprint $table) {
            $table->id();
            $table->string('url', 2048)->unique();
            $table->string('title', 500)->nullable();
            $table->string('content_hash', 64);
            $table->string('status', 30)->default('active');
            $table->timestamp('crawled_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'crawled_at']);
        });

        Schema::create('knowledge_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('knowledge_document_id')
                ->constrained('knowledge_documents')
                ->cascadeOnDelete();
            $table->unsignedInteger('chunk_index');
            $table->text('content');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['knowledge_document_id', 'chunk_index']);
        });

        Schema::create('knowledge_ingestion_runs', function (Blueprint $table) {
            $table->id();
            $table->string('base_url', 2048);
            $table->string('status', 30)->default('running');
            $table->unsignedInteger('pages_seen')->default(0);
            $table->unsignedInteger('pages_stored')->default(0);
            $table->unsignedInteger('chunks_stored')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'started_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "CREATE INDEX knowledge_chunks_content_fts_idx ON knowledge_chunks USING GIN (to_tsvector('simple', content))"
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_ingestion_runs');
        Schema::dropIfExists('knowledge_chunks');
        Schema::dropIfExists('knowledge_documents');
    }
};
