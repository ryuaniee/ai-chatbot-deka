<?php

namespace Tests\Unit;

use App\Services\Knowledge\KnowledgeChunker;
use PHPUnit\Framework\TestCase;

class KnowledgeChunkerTest extends TestCase
{
    public function test_keeps_markdown_team_section_together(): void
    {
        $content = <<<'MARKDOWN'
# DEKA

## Analisis Perusahaan

Isi analisis yang tidak berkaitan dengan daftar tim.

### Struktur Tim

1. Topan - Project Manager
2. Irfan - Programmer
3. Rilo - Programmer
4. Adi - Wakil Direktur, HRD, Administrasi
5. Abdul Rahman - Direktur, Design UX/UI
6. Dafi - Web Developer
7. Fahmi - Sekretaris Administrasi
8. Muhammad Rizky Hajar - Penasehat

## Referensi

Website resmi DEKA.
MARKDOWN;

        $chunks = (new KnowledgeChunker)->chunk($content, 1200, 180);
        $teamChunk = collect($chunks)->first(
            static fn (string $chunk): bool => str_contains($chunk, '### Struktur Tim'),
        );

        $this->assertIsString($teamChunk);
        $this->assertStringContainsString('Topan - Project Manager', $teamChunk);
        $this->assertStringContainsString('Dafi - Web Developer', $teamChunk);
        $this->assertStringContainsString('Muhammad Rizky Hajar - Penasehat', $teamChunk);
        $this->assertStringNotContainsString('Isi analisis yang tidak berkaitan', $teamChunk);
        $this->assertStringNotContainsString('Website resmi DEKA', $teamChunk);
    }

    public function test_short_final_slice_does_not_create_duplicate_tail_chunks(): void
    {
        $content = str_repeat('Kalimat knowledge DEKA yang cukup panjang. ', 40).'Penutup singkat.';

        $chunks = (new KnowledgeChunker)->chunk($content, 500, 180);

        $this->assertLessThan(10, count($chunks));
        $this->assertStringContainsString('Penutup singkat.', $chunks[array_key_last($chunks)]);
    }
}
