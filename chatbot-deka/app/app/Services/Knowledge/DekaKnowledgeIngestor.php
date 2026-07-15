<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeDocument;
use App\Models\KnowledgeIngestionRun;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class DekaKnowledgeIngestor
{
    public function __construct(
        private readonly DekaKnowledgeCleaner $cleaner,
    ) {}

    /**
     * @return array{run_id: int, status: string, pages_seen: int, pages_stored: int, chunks_stored: int}
     */
    public function ingest(?string $baseUrl = null, ?int $limit = null, bool $fresh = false): array
    {
        $baseUrl = $this->normalizeBaseUrl($baseUrl ?? (string) config('services.deka_knowledge.base_url'));
        $limit ??= (int) config('services.deka_knowledge.max_pages', 50);

        $run = KnowledgeIngestionRun::query()->create([
            'base_url' => $baseUrl,
            'status' => 'running',
            'started_at' => now(),
            'metadata' => ['fresh' => $fresh],
        ]);

        try {
            $urls = $this->discoverUrls($baseUrl, $limit);
            $pagesStored = 0;
            $chunksStored = 0;
            $storedUrls = [];

            foreach ($urls as $url) {
                $storedChunks = $this->ingestPage($baseUrl, $url);

                if ($storedChunks > 0) {
                    $pagesStored++;
                    $chunksStored += $storedChunks;
                    $storedUrls[] = $url;
                }
            }

            if ($fresh && $storedUrls !== []) {
                KnowledgeDocument::query()
                    ->where('url', 'like', $baseUrl.'%')
                    ->whereNotIn('url', $storedUrls)
                    ->delete();
            }

            $run->forceFill([
                'status' => 'completed',
                'pages_seen' => count($urls),
                'pages_stored' => $pagesStored,
                'chunks_stored' => $chunksStored,
                'finished_at' => now(),
            ])->save();
        } catch (Throwable $exception) {
            $run->forceFill([
                'status' => 'failed',
                'error_message' => $exception->getMessage(),
                'finished_at' => now(),
            ])->save();

            throw $exception;
        }

        return [
            'run_id' => $run->id,
            'status' => $run->status,
            'pages_seen' => $run->pages_seen,
            'pages_stored' => $run->pages_stored,
            'chunks_stored' => $run->chunks_stored,
        ];
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

        return array_slice(array_values(array_unique($urls)), 0, max(1, $limit));
    }

    private function ingestPage(string $baseUrl, string $url): int
    {
        $response = Http::timeout((int) config('services.deka_knowledge.http_timeout', 45))
            ->retry(2, 500)
            ->accept('text/html,application/xhtml+xml')
            ->get($url);

        if (! $response->successful()) {
            return 0;
        }

        $contentType = strtolower((string) $response->header('content-type'));

        if ($contentType !== '' && ! str_contains($contentType, 'html')) {
            return 0;
        }

        $extracted = $this->cleaner->extract($response->body());
        $content = $extracted['content'];

        if (mb_strlen($content) < 80) {
            return 0;
        }

        $chunks = $this->cleaner->chunk(
            $content,
            (int) config('services.deka_knowledge.chunk_size', 1200),
            (int) config('services.deka_knowledge.chunk_overlap', 180),
        );

        if ($chunks === []) {
            return 0;
        }

        return DB::transaction(function () use ($url, $baseUrl, $extracted, $content, $chunks): int {
            $document = KnowledgeDocument::query()->updateOrCreate(
                ['url' => $url],
                [
                    'title' => $extracted['title'],
                    'content_hash' => hash('sha256', $content),
                    'status' => 'active',
                    'crawled_at' => now(),
                    'metadata' => [
                        'base_url' => $baseUrl,
                        'content_length' => mb_strlen($content),
                    ],
                ],
            );

            $document->chunks()->delete();

            foreach ($chunks as $index => $chunk) {
                $document->chunks()->create([
                    'chunk_index' => $index,
                    'content' => $chunk,
                    'metadata' => [
                        'content_length' => mb_strlen($chunk),
                    ],
                ]);
            }

            return count($chunks);
        });
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

        if ($url === '') {
            return 'https://deka.dev';
        }

        return $url;
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
