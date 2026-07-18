<?php

namespace App\Console\Commands;

use App\Models\KnowledgeIngestionRun;
use App\Services\Knowledge\KnowledgeIngestor;
use App\Services\Knowledge\KnowledgeTextExtractor;
use Illuminate\Console\Command;
use Throwable;

class IngestKnowledgeFile extends Command
{
    protected $signature = 'knowledge:ingest-file
        {path : Local file path}
        {--title= : Override document title}
        {--source= : Override source URI shown in citations}';

    protected $description = 'Ingest a local document into the Deka knowledge base.';

    public function handle(KnowledgeTextExtractor $extractor, KnowledgeIngestor $ingestor): int
    {
        $path = (string) $this->argument('path');
        $sourceUri = (string) ($this->option('source') ?: realpath($path) ?: $path);

        $run = KnowledgeIngestionRun::query()->create([
            'source_type' => 'file',
            'source_uri' => $sourceUri,
            'status' => 'running',
            'started_at' => now(),
            'metadata' => ['path' => $path],
        ]);

        try {
            $extracted = $extractor->fromFile($path);
            $result = $ingestor->ingestText(
                sourceType: 'file',
                sourceUri: $sourceUri,
                content: $extracted['content'],
                title: (string) ($this->option('title') ?: $extracted['title']),
                metadata: $extracted['metadata'],
            );

            $run->forceFill([
                'status' => 'completed',
                'pages_seen' => 1,
                'documents_stored' => 1,
                'chunks_stored' => $result['chunks_stored'],
                'finished_at' => now(),
            ])->save();

            $this->info("Ingested file into document #{$result['document_id']} with {$result['chunks_stored']} chunks.");

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $run->forceFill([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'finished_at' => now(),
            ])->save();

            throw $exception;
        }
    }
}
