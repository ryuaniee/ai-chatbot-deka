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
        {--source= : Override source URI shown in citations}
        {--priority=100 : Source priority; higher values win when facts conflict}';

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
                metadata: $extracted['metadata'] + ['source_priority' => max(0, (int) $this->option('priority'))],
            );

            $run->forceFill([
                'status' => $result['status'] === 'failed' ? 'validation_failed' : 'completed',
                'pages_seen' => 1,
                'documents_stored' => 1,
                'chunks_stored' => $result['chunks_stored'],
                'finished_at' => now(),
                'metadata' => [
                    'path' => $path,
                    'document_id' => $result['document_id'],
                    'version_id' => $result['version_id'],
                    'version' => $result['version'],
                    'changed_chunks' => $result['changed_chunks'],
                    'validation' => $result['validation'],
                ],
            ])->save();

            $this->line(sprintf(
                'Document #%d version %s: %s (%d chunks, %d changed).',
                $result['document_id'],
                $result['version'] ?? '-',
                $result['status'],
                $result['chunks_stored'],
                $result['changed_chunks'],
            ));

            $validation = $result['validation'] ?? [];
            $this->line(sprintf(
                'Validation: %d/%d probes passed%s.',
                $validation['probes_passed'] ?? 0,
                $validation['probes_total'] ?? 0,
                filled($validation['error'] ?? null) ? ' - '.$validation['error'] : '',
            ));

            foreach ($validation['cases'] ?? [] as $case) {
                $this->line(sprintf(
                    '[%s] chunk %d: %s',
                    ($case['passed'] ?? false) ? 'PASS' : 'FAIL',
                    $case['chunk_index'] ?? -1,
                    $case['question'] ?? '-',
                ));
            }

            return $result['status'] === 'failed' ? self::FAILURE : self::SUCCESS;
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
