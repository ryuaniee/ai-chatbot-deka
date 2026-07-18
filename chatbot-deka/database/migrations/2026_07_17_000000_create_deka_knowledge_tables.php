<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            Schema::ensureVectorExtensionExists();
        }

        Schema::create('knowledge_documents', function (Blueprint $table) {
            $table->id();
            $table->string('source_type', 30);
            $table->string('source_uri', 2048)->unique();
            $table->string('canonical_uri', 2048)->nullable();
            $table->string('title', 500)->nullable();
            $table->string('content_hash', 64);
            $table->string('status', 30)->default('active');
            $table->string('language', 16)->nullable();
            $table->timestamp('last_ingested_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'source_type']);
            $table->index('last_ingested_at');
        });

        Schema::create('knowledge_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('knowledge_document_id')
                ->constrained('knowledge_documents')
                ->cascadeOnDelete();
            $table->unsignedInteger('chunk_index');
            $table->text('content');
            $table->string('content_hash', 64);
            $table->unsignedInteger('token_count')->default(0);
            $table->string('embedding_provider', 80);
            $table->string('embedding_model', 120);

            if (DB::getDriverName() === 'pgsql') {
                $table->vector('embedding', (int) config('services.deka_knowledge.embedding_dimensions', 1536));
            } else {
                $table->json('embedding');
            }

            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['knowledge_document_id', 'chunk_index']);
            $table->index(['embedding_provider', 'embedding_model']);
        });

        Schema::create('knowledge_ingestion_runs', function (Blueprint $table) {
            $table->id();
            $table->string('source_type', 30);
            $table->string('source_uri', 2048);
            $table->string('status', 30)->default('running');
            $table->unsignedInteger('pages_seen')->default(0);
            $table->unsignedInteger('documents_stored')->default(0);
            $table->unsignedInteger('chunks_stored')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'started_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            Schema::table('knowledge_chunks', function (Blueprint $table) {
                $table->vectorIndex('embedding');
            });

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
