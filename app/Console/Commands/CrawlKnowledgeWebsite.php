<?php

namespace App\Console\Commands;

use App\Models\KnowledgeDocument;
use App\Models\KnowledgeIngestionRun;
use App\Services\Knowledge\KnowledgeIngestor;
use App\Services\Knowledge\KnowledgeTextExtractor;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class CrawlKnowledgeWebsite extends Command
{
    protected $signature = 'knowledge:crawl
        {--base= : Base website URL}
        {--limit=50 : Maximum pages to crawl}
        {--fresh : Delete previously stored pages from this base URL that are no longer discovered}';

    protected $description = 'Crawl a website and ingest pages into the Deka knowledge base.';

    public function handle(KnowledgeTextExtractor $extractor, KnowledgeIngestor $ingestor): int
    {
        $baseUrl = $this->normalizeBaseUrl((string) ($this->option('base') ?: config('services.deka_knowledge.base_url')));
        $limit = max(1, (int) $this->option('limit'));
        $fresh = (bool) $this->option('fresh');

        $run = KnowledgeIngestionRun::query()->create([
            'source_type' => 'website',
            'source_uri' => $baseUrl,
            'status' => 'running',
            'started_at' => now(),
            'metadata' => ['fresh' => $fresh],
        ]);

        try {
            $urls = $this->discoverUrls($baseUrl, $limit);
            $documentsStored = 0;
            $chunksStored = 0;
            $storedUrls = [];

            foreach ($urls as $url) {
                $stored = $this->ingestUrl($url, $baseUrl, $extractor, $ingestor);

                if ($stored === null) {
                    continue;
                }

                $documentsStored++;
                $chunksStored += $stored['chunks_stored'];
                $storedUrls[] = $url;
                $this->line("Stored {$url} ({$stored['chunks_stored']} chunks)");
            }

            if ($fresh && $storedUrls !== []) {
                KnowledgeDocument::query()
                    ->where('source_type', 'website')
                    ->where('source_uri', 'like', $baseUrl.'%')
                    ->whereNotIn('source_uri', $storedUrls)
                    ->delete();
            }

            $run->forceFill([
                'status' => 'completed',
                'pages_seen' => count($urls),
                'documents_stored' => $documentsStored,
                'chunks_stored' => $chunksStored,
                'finished_at' => now(),
            ])->save();

            $this->info("Crawled {$run->pages_seen} pages, stored {$documentsStored} documents and {$chunksStored} chunks.");

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

    /**
     * @return array<int, string>
     */
    private function discoverUrls(string $baseUrl, int $limit): array
    {
        $urls = $this->urlsFromSitemap($baseUrl);

        if ($urls === []) {
            $urls = [$baseUrl, ...$this->internalLinksFromPage($baseUrl, $baseUrl)];
        }

        return array_slice(array_values(array_unique($urls)), 0, $limit);
    }

    /**
     * @return array{document_id: int, chunks_stored: int}|null
     */
    private function ingestUrl(
        string $url,
        string $baseUrl,
        KnowledgeTextExtractor $extractor,
        KnowledgeIngestor $ingestor,
    ): ?array {
        $response = Http::timeout((int) config('services.deka_knowledge.http_timeout', 45))
            ->retry(2, 500)
            ->accept('text/html,application/xhtml+xml')
            ->get($url);

        if (! $response->successful()) {
            return null;
        }

        $contentType = strtolower((string) $response->header('content-type'));

        if ($contentType !== '' && ! str_contains($contentType, 'html')) {
            return null;
        }

        $extracted = $extractor->fromHtml($response->body());

        return $ingestor->ingestText(
            sourceType: 'website',
            sourceUri: $url,
            content: $extracted['content'],
            title: $extracted['title'],
            canonicalUri: $url,
            metadata: $extracted['metadata'] + ['base_url' => $baseUrl],
        );
    }

    /**
     * @return array<int, string>
     */
    private function urlsFromSitemap(string $baseUrl): array
    {
        $response = Http::timeout((int) config('services.deka_knowledge.http_timeout', 45))
            ->retry(2, 500)
            ->accept('application/xml,text/xml')
            ->get($baseUrl.'/sitemap.xml');

        if (! $response->successful()) {
            return [];
        }

        $xml = @simplexml_load_string($response->body());

        if ($xml === false) {
            return [];
        }

        $urls = [];

        foreach ($xml->url as $urlNode) {
            $url = $this->normalizeUrl((string) $urlNode->loc, $baseUrl);

            if ($url !== null) {
                $urls[] = $url;
            }
        }

        return $urls;
    }

    /**
     * @return array<int, string>
     */
    private function internalLinksFromPage(string $baseUrl, string $url): array
    {
        $response = Http::timeout((int) config('services.deka_knowledge.http_timeout', 45))
            ->retry(2, 500)
            ->accept('text/html,application/xhtml+xml')
            ->get($url);

        if (! $response->successful()) {
            return [];
        }

        $document = new DOMDocument;
        libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="utf-8" ?>'.$response->body(), LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();

        $xpath = new DOMXPath($document);
        $urls = [];

        foreach ($xpath->query('//a[@href]') ?: [] as $node) {
            if (! $node instanceof DOMElement) {
                continue;
            }

            $normalized = $this->normalizeUrl($node->getAttribute('href'), $baseUrl);

            if ($normalized !== null) {
                $urls[] = $normalized;
            }
        }

        return $urls;
    }

    private function normalizeBaseUrl(string $url): string
    {
        $url = rtrim(trim($url), '/');

        return $url !== '' ? $url : 'https://deka.dev';
    }

    private function normalizeUrl(string $url, string $baseUrl): ?string
    {
        $url = trim($url);

        if ($url === '' || str_starts_with($url, '#') || Str::startsWith($url, ['mailto:', 'tel:', 'javascript:'])) {
            return null;
        }

        if (str_starts_with($url, '/')) {
            $url = $baseUrl.$url;
        }

        $url = strtok($url, '#') ?: $url;
        $url = rtrim($url, '/');
        $baseHost = parse_url($baseUrl, PHP_URL_HOST);
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($baseHost) || ! is_string($host) || strtolower($host) !== strtolower($baseHost)) {
            return null;
        }

        return $url;
    }
}
