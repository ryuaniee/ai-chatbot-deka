<?php

namespace Database\Seeders;

use App\Models\KnowledgeDocument;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DekaManualKnowledgeSeeder extends Seeder
{
    /**
     * Manual knowledge belongs in seed data, not environment variables.
     *
     * @var array<int, array{
     *     url: string,
     *     title: string,
     *     content: string,
     *     metadata: array<string, string|null>
     * }>
     */
    private array $documents = [
        [
            'url' => 'manual://deka/contact',
            'title' => 'Kontak dan Alamat Deka',
            'content' => 'Alamat kantor Deka tersedia melalui Google Maps: https://maps.app.goo.gl/uxNnW4yFhtJVYYFa9.',
            'metadata' => [
                'source' => 'manual',
                'maps_url' => 'https://maps.app.goo.gl/uxNnW4yFhtJVYYFa9',
                'email' => null,
                'phone' => null,
                'whatsapp' => null,
            ],
        ],
    ];

    public function run(): void
    {
        foreach ($this->documents as $manualDocument) {
            DB::transaction(function () use ($manualDocument): void {
                $document = KnowledgeDocument::query()->updateOrCreate(
                    ['url' => $manualDocument['url']],
                    [
                        'title' => $manualDocument['title'],
                        'content_hash' => hash('sha256', $manualDocument['content']),
                        'status' => 'active',
                        'crawled_at' => now(),
                        'metadata' => $manualDocument['metadata'],
                    ],
                );

                $document->chunks()->delete();
                $document->chunks()->create([
                    'chunk_index' => 0,
                    'content' => $manualDocument['content'],
                    'metadata' => $manualDocument['metadata'],
                ]);
            });
        }
    }
}
