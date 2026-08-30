<?php

namespace App\Console\Commands;

use App\Models\KnowledgeIngestionRun;
use App\Services\Knowledge\KnowledgeIngestor;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class CrawlInaprocDekaProducts extends Command
{
    protected $signature = 'knowledge:crawl-inaproc-products
        {--seller-id=01JD1BQ5PB6FNXGC1QC87KCAJT : INAPROC seller ID}
        {--seller-slug=deka : INAPROC seller slug}
        {--start-page=1 : First page to crawl}
        {--per-page=50 : Products per page}
        {--max-pages=0 : Maximum number of pages to crawl; 0 means all remaining pages}
        {--keyword= : Optional catalogue keyword}
        {--priority=120 : Source priority; higher values win when facts conflict}
        {--dry-run : Fetch and print a summary without ingesting}';

    protected $description = 'Crawl DEKA products from INAPROC Katalog Elektronik and ingest them into the knowledge base.';

    private const GRAPHQL_ENDPOINT = 'https://katalog.inaproc.id/graphql';

    public function handle(KnowledgeIngestor $ingestor): int
    {
        $sellerId = trim((string) $this->option('seller-id'));
        $sellerSlug = trim((string) $this->option('seller-slug')) ?: 'deka';
        $startPage = max(1, (int) $this->option('start-page'));
        $perPage = min(50, max(1, (int) $this->option('per-page')));
        $maxPages = max(0, (int) $this->option('max-pages'));
        $keyword = trim((string) $this->option('keyword')) ?: null;
        $sourceUri = "https://katalog.inaproc.id/{$sellerSlug}";

        if ($sellerId === '') {
            $this->error('Seller ID is required.');

            return self::FAILURE;
        }

        $run = KnowledgeIngestionRun::query()->create([
            'source_type' => 'inaproc',
            'source_uri' => $sourceUri,
            'status' => 'running',
            'started_at' => now(),
            'metadata' => [
                'seller_id' => $sellerId,
                'seller_slug' => $sellerSlug,
                'start_page' => $startPage,
                'per_page' => $perPage,
                'max_pages' => $maxPages,
                'keyword' => $keyword,
                'dry_run' => (bool) $this->option('dry-run'),
            ],
        ]);

        try {
            $products = [];
            $lastPage = null;
            $total = null;
            $pagesFetched = 0;

            for ($page = $startPage; $lastPage === null || $page <= $lastPage; $page++) {
                if ($maxPages > 0 && $pagesFetched >= $maxPages) {
                    break;
                }

                $result = $this->fetchProductsPage($sellerId, $page, $perPage, $keyword);
                $items = (array) ($result['items'] ?? []);
                $lastPage = max(1, (int) ($result['lastPage'] ?? $page));
                $total = (int) ($result['total'] ?? count($items));
                $pagesFetched++;

                foreach ($items as $item) {
                    if (is_array($item)) {
                        $products[$item['id'] ?? "{$page}-".count($products)] = $item;
                    }
                }

                $this->line("Fetched page {$page}/{$lastPage} (".count($items).' products).');

                if ($items === []) {
                    break;
                }

                usleep(250_000);
            }

            $products = array_values($products);
            $catalogIndex = $this->formatCatalogIndexContent($products, $sourceUri, $total);
            $content = $this->formatProductsContent($products, $sourceUri, $total);

            if ((bool) $this->option('dry-run')) {
                $run->forceFill([
                    'status' => 'completed',
                    'pages_seen' => $pagesFetched,
                    'documents_stored' => 0,
                    'chunks_stored' => 0,
                    'finished_at' => now(),
                    'metadata' => ($run->metadata ?? []) + [
                        'products_seen' => count($products),
                        'reported_total' => $total,
                    ],
                ])->save();

                $this->info('Found '.count($products).' products. Dry run only.');

                return self::SUCCESS;
            }

            // Keep an intentionally compact index separate from product details. A list request
            // can then retrieve the complete catalogue without losing entries to chunk ranking.
            $indexStored = $ingestor->ingestText(
                sourceType: 'inaproc',
                sourceUri: "{$sourceUri}/catalog-index",
                content: $catalogIndex,
                title: 'Indeks Produk DEKA di INAPROC Katalog Elektronik',
                canonicalUri: $sourceUri,
                metadata: [
                    'seller_id' => $sellerId,
                    'seller_slug' => $sellerSlug,
                    'product_count' => count($products),
                    'reported_total' => $total,
                    'document_kind' => 'catalog_index',
                    'source_priority' => max(0, (int) $this->option('priority')) + 1,
                ],
            );

            $stored = $ingestor->ingestText(
                sourceType: 'inaproc',
                sourceUri: $sourceUri,
                content: $content,
                title: 'Produk DEKA di INAPROC Katalog Elektronik',
                canonicalUri: $sourceUri,
                metadata: [
                    'seller_id' => $sellerId,
                    'seller_slug' => $sellerSlug,
                    'product_count' => count($products),
                    'reported_total' => $total,
                    'source_priority' => max(0, (int) $this->option('priority')),
                ],
            );

            if (($indexStored['status'] ?? null) === 'failed' || ($stored['status'] ?? null) === 'failed') {
                throw new RuntimeException('Knowledge validation failed for INAPROC products; previous active version remains in use.');
            }

            $run->forceFill([
                'status' => 'completed',
                'pages_seen' => $pagesFetched,
                'documents_stored' => 2,
                'chunks_stored' => $indexStored['chunks_stored'] + $stored['chunks_stored'],
                'finished_at' => now(),
                'metadata' => ($run->metadata ?? []) + [
                    'document_id' => $stored['document_id'],
                    'version_id' => $stored['version_id'],
                    'catalog_index_document_id' => $indexStored['document_id'],
                    'catalog_index_version_id' => $indexStored['version_id'],
                    'products_seen' => count($products),
                    'reported_total' => $total,
                    'validation' => $stored['validation'],
                ],
            ])->save();

            $this->info('Stored '.count($products)." products from {$sourceUri} (".($indexStored['chunks_stored'] + $stored['chunks_stored']).' chunks).');

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
     * @return array<string, mixed>
     */
    private function fetchProductsPage(string $sellerId, int $page, int $perPage, ?string $keyword): array
    {
        $response = Http::timeout((int) config('services.deka_knowledge.http_timeout', 45))
            ->retry(2, 500)
            ->acceptJson()
            ->asJson()
            ->withHeaders([
                'Referer' => 'https://katalog.inaproc.id/deka',
                'Origin' => 'https://katalog.inaproc.id',
            ])
            ->post(self::GRAPHQL_ENDPOINT, [
                'query' => $this->productsQuery(),
                'variables' => [
                    'input' => [
                        'sort' => [
                            ['field' => 'CREATED_AT', 'order' => 'DESC'],
                        ],
                        'filter' => array_filter([
                            'strategy' => 'SELLER_CATALOGUE',
                            'sellerId' => $sellerId,
                            'keyword' => $keyword,
                        ], fn ($value): bool => $value !== null && $value !== ''),
                        'pagination' => [
                            'page' => $page,
                            'perPage' => $perPage,
                        ],
                    ],
                ],
            ]);

        if (! $response->successful()) {
            throw new RuntimeException("INAPROC request failed for page {$page}: HTTP {$response->status()}");
        }

        $payload = $response->json();
        $errors = $payload['errors'] ?? null;

        if (is_array($errors) && $errors !== []) {
            throw new RuntimeException('INAPROC GraphQL error: '.json_encode($errors, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        $result = Arr::get($payload, 'data.searchProducts');

        if (! is_array($result)) {
            throw new RuntimeException("INAPROC returned an invalid products payload for page {$page}.");
        }

        if (($result['__typename'] ?? null) === 'GenericError') {
            throw new RuntimeException((string) ($result['message'] ?? 'INAPROC returned a GenericError.'));
        }

        return $result;
    }

    private function productsQuery(): string
    {
        return <<<'GRAPHQL'
query searchProducts($input: SearchProductInput!) {
  searchProducts(input: $input) {
    __typename
    ... on ListSearchProductResponse {
      total
      perPage
      currentPage
      lastPage
      items {
        id
        name
        slug
        username
        sellerId
        sellerName
        status
        isActive
        defaultPrice
        defaultPriceWithTax
        minPrice
        maxPrice
        minPriceWithTax
        maxPriceWithTax
        images
        stockAvailability
        stockAccumulation
        unitSold
        tkdn {
          value
          bmpValue
          tkdnBmp
          status
        }
        rating {
          count
          average
        }
        category {
          id
          name
        }
        brand {
          brandName
          status
        }
        variants {
          id
          isActive
          price
          priceWithTax
          stock
          options {
            name
            value
          }
        }
      }
    }
    ... on GenericError {
      code
      message
      reqId
    }
  }
}
GRAPHQL;
    }

    /**
     * @param  array<int, array<string, mixed>>  $products
     */
    private function formatProductsContent(array $products, string $sourceUri, ?int $reportedTotal): string
    {
        $lines = [
            '# Produk DEKA di INAPROC Katalog Elektronik',
            '',
            "Sumber: {$sourceUri}",
            'Tanggal scrape: '.now()->toDateTimeString(),
            'Total produk menurut INAPROC: '.($reportedTotal ?? count($products)),
            'Total produk tersimpan: '.count($products),
            '',
        ];

        foreach ($products as $index => $product) {
            $number = $index + 1;
            $name = (string) ($product['name'] ?? 'Produk tanpa nama');
            $url = $this->productUrl($product);

            $lines[] = "## {$number}. {$name}";
            $lines[] = "URL produk: {$url}";
            $lines[] = 'Status: '.($product['status'] ?? '-');
            $lines[] = 'Aktif: '.($product['isActive'] ?? false ? 'ya' : 'tidak');
            $lines[] = 'Penjual: '.($product['sellerName'] ?? 'DEKA');
            $lines[] = 'Kategori: '.(string) data_get($product, 'category.name', '-');
            $lines[] = 'Brand: '.(string) (data_get($product, 'brand.brandName') ?: '-');
            $lines[] = 'Harga default sebelum pajak: '.$this->formatMoney($product['defaultPrice'] ?? null);
            $lines[] = 'Harga default dengan pajak: '.$this->formatMoney($product['defaultPriceWithTax'] ?? null);
            $lines[] = 'Harga minimum: '.$this->formatMoney($product['minPrice'] ?? null);
            $lines[] = 'Harga maksimum: '.$this->formatMoney($product['maxPrice'] ?? null);
            $lines[] = 'Stok tersedia: '.(string) ($product['stockAvailability'] ?? '-');
            $lines[] = 'Akumulasi stok: '.(string) ($product['stockAccumulation'] ?? '-');
            $lines[] = 'Terjual: '.(string) ($product['unitSold'] ?? '-');
            $lines[] = 'TKDN: '.(string) (data_get($product, 'tkdn.value') ?? '-');
            $lines[] = 'BMP: '.(string) (data_get($product, 'tkdn.bmpValue') ?? '-');
            $lines[] = 'TKDN + BMP: '.(string) (data_get($product, 'tkdn.tkdnBmp') ?? '-');
            $lines[] = 'Rating: '.(string) (data_get($product, 'rating.average') ?? '-').' dari '.(string) (data_get($product, 'rating.count') ?? 0).' penilaian';
            $lines[] = 'Gambar: '.$this->formatImages((array) ($product['images'] ?? []));
            $lines[] = 'Varian: '.$this->formatVariants((array) ($product['variants'] ?? []));
            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<int, array<string, mixed>>  $products
     */
    private function formatCatalogIndexContent(array $products, string $sourceUri, ?int $reportedTotal): string
    {
        $lines = [
            '# Indeks Produk DEKA di INAPROC Katalog Elektronik',
            '',
            "Sumber: {$sourceUri}",
            'Total produk menurut INAPROC: '.($reportedTotal ?? count($products)),
            'Total produk tersimpan: '.count($products),
            '',
            'Daftar lengkap produk:',
        ];

        foreach ($products as $index => $product) {
            $number = $index + 1;
            $name = trim((string) ($product['name'] ?? 'Produk tanpa nama'));

            $lines[] = "{$number}. {$name} | URL: ".$this->productUrl($product);
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $product
     */
    private function productUrl(array $product): string
    {
        $username = trim((string) ($product['username'] ?? 'deka'));
        $slug = trim((string) ($product['slug'] ?? ''));

        return $slug !== ''
            ? "https://katalog.inaproc.id/{$username}/{$slug}"
            : "https://katalog.inaproc.id/{$username}";
    }

    private function formatMoney(mixed $value): string
    {
        if (! is_numeric($value)) {
            return '-';
        }

        return 'Rp '.number_format((float) $value, 0, ',', '.');
    }

    /**
     * @param  array<int, string>  $images
     */
    private function formatImages(array $images): string
    {
        $images = array_values(array_filter($images, fn (string $image): bool => trim($image) !== ''));

        return $images === [] ? '-' : implode(', ', $images);
    }

    /**
     * @param  array<int, array<string, mixed>>  $variants
     */
    private function formatVariants(array $variants): string
    {
        if ($variants === []) {
            return '-';
        }

        return collect($variants)
            ->map(function (array $variant): string {
                $options = collect((array) ($variant['options'] ?? []))
                    ->map(fn (array $option): string => trim(((string) ($option['name'] ?? '')).' '.((string) ($option['value'] ?? ''))))
                    ->filter()
                    ->implode(', ');

                $price = $this->formatMoney($variant['priceWithTax'] ?? $variant['price'] ?? null);
                $stock = (string) ($variant['stock'] ?? '-');

                return trim(($options !== '' ? "{$options}; " : '')."harga {$price}; stok {$stock}");
            })
            ->implode(' | ');
    }
}
