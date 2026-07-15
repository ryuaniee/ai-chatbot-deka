<?php

namespace App\Console\Commands;

use App\Services\Knowledge\DekaKnowledgeIngestor;
use Database\Seeders\DekaManualKnowledgeSeeder;
use Illuminate\Console\Command;

class IngestDekaKnowledge extends Command
{
    protected $signature = 'deka:knowledge:ingest
        {--url= : Base URL to crawl}
        {--limit= : Maximum pages to crawl}
        {--fresh : Delete existing documents for the base URL before ingesting}';

    protected $description = 'Ingest public Deka website pages into the local knowledge store.';

    public function handle(DekaKnowledgeIngestor $ingestor, DekaManualKnowledgeSeeder $manualKnowledgeSeeder): int
    {
        $url = $this->option('url');
        $limit = $this->option('limit');

        $result = $ingestor->ingest(
            is_string($url) && $url !== '' ? $url : null,
            is_numeric($limit) ? (int) $limit : null,
            (bool) $this->option('fresh'),
        );

        $this->components->info(sprintf(
            'Knowledge ingest %s: %d page(s), %d chunk(s).',
            $result['status'],
            $result['pages_stored'],
            $result['chunks_stored'],
        ));

        $manualKnowledgeSeeder->run();
        $this->components->info('Manual Deka knowledge seeded.');

        return self::SUCCESS;
    }
}
