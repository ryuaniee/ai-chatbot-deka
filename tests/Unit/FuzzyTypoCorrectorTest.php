<?php

namespace Tests\Unit;

use App\Services\Knowledge\FuzzyTypoCorrector;
use PHPUnit\Framework\TestCase;

class FuzzyTypoCorrectorTest extends TestCase
{
    public function test_corrects_common_domain_typos_without_manual_pairs(): void
    {
        $corrector = new FuzzyTypoCorrector([
            'layanan',
            'alamat',
            'lokasi',
            'operasional',
            'kontak',
            'deka',
            'pendiri',
            'portofolio',
        ]);

        $this->assertSame(
            'Apa saja layanan utama DEKA?',
            $corrector->correct('Apa saja lynayan utama DEKA?'),
        );
        $this->assertSame(
            'Dimana alamat kantor DEKA?',
            $corrector->correct('Dimana almat kantor DEKA?'),
        );
        $this->assertSame(
            'lokasi kantor DEKA',
            $corrector->correct('loksi kantor DEKA'),
        );
        $this->assertSame(
            'jam operasional DEKA',
            $corrector->correct('jam oprasional DEKA'),
        );
    }

    public function test_keeps_exact_words_unchanged(): void
    {
        $corrector = new FuzzyTypoCorrector(['layanan', 'deka']);

        $this->assertSame(
            'layanan DEKA',
            $corrector->correct('layanan DEKA'),
        );
    }

    public function test_reports_token_corrections(): void
    {
        $corrector = new FuzzyTypoCorrector(['alamat', 'deka']);

        $this->assertSame(
            ['almat' => 'alamat'],
            $corrector->corrections('almat DEKA'),
        );
    }

    public function test_prefers_siapa_for_transposed_question_word(): void
    {
        $corrector = new FuzzyTypoCorrector(['siapa', 'siap']);

        $this->assertSame('UI UX di DEKA itu siapa', $corrector->correct('UI UX di DEKA itu saiapa'));
    }
}
