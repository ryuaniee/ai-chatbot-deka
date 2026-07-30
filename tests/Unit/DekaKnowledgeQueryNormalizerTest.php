<?php

namespace Tests\Unit;

use App\Services\Knowledge\DekaKnowledgeQueryNormalizer;
use App\Services\Knowledge\FuzzyTypoCorrector;
use PHPUnit\Framework\TestCase;

class DekaKnowledgeQueryNormalizerTest extends TestCase
{
    private function normalizer(): DekaKnowledgeQueryNormalizer
    {
        return new DekaKnowledgeQueryNormalizer(new FuzzyTypoCorrector([
            'layanan',
            'alamat',
            'lokasi',
            'operasional',
            'kontak',
            'deka',
            'pendiri',
            'portofolio',
            'founder',
            'rizky',
            'siapa',
            'siap',
            'design',
        ]));
    }

    public function test_expands_contact_follow_up_to_deka_contact_queries(): void
    {
        $result = $this->normalizer()->normalize('kontaknya', [
            ['role' => 'assistant', 'content' => 'Kamu bisa tanya profil, layanan, proyek, founder, sejarah, atau kontak DEKA.'],
        ]);

        $this->assertSame('kontak DEKA', $result['primary']);
        $this->assertContains('alamat DEKA', $result['alternates']);
    }

    public function test_fixes_deka_typo_and_adds_contact_queries(): void
    {
        $result = $this->normalizer()->normalize('kontak deak');

        $this->assertSame('kontak DEKA', $result['primary']);
        $this->assertContains('alamat DEKA', $result['alternates']);
    }

    public function test_corrects_person_name_from_dynamic_vocabulary_without_identity_mapping(): void
    {
        $result = $this->normalizer()->normalize('pak riski siapa deka?');

        $this->assertSame('pak rizky siapa DEKA?', $result['primary']);
        $this->assertNotContains('Muhammad Rizky Hajar', $result['alternates']);
    }

    public function test_marks_vague_person_question_as_ambiguous(): void
    {
        $result = $this->normalizer()->normalize('pak siapa di deka?');

        $this->assertTrue($result['ambiguous']);
    }

    public function test_fuzzy_corrects_unknown_typos_without_manual_pairs(): void
    {
        $result = $this->normalizer()->normalize('lynayan utama deka');
        $blob = mb_strtolower($result['primary'].' '.implode(' ', $result['alternates']));

        $this->assertStringContainsString('layanan', $blob);
    }

    public function test_fuzzy_corrects_address_and_hours_typos(): void
    {
        $alamat = $this->normalizer()->normalize('almat kntr deka');
        $alamatBlob = mb_strtolower($alamat['primary'].' '.implode(' ', $alamat['alternates']));
        $this->assertStringContainsString('alamat', $alamatBlob);
        $this->assertStringContainsString('kantor', $alamatBlob);

        $jam = $this->normalizer()->normalize('jam oprasional deka');
        $jamBlob = mb_strtolower($jam['primary'].' '.implode(' ', $jam['alternates']));
        $this->assertStringContainsString('operasional', $jamBlob);
    }

    public function test_employee_question_is_not_misclassified_as_whatsapp_contact(): void
    {
        $result = $this->normalizer()->normalize('ini nama karyawan deka');

        $this->assertSame('tim karyawan DEKA', $result['primary']);
        $this->assertContains('daftar karyawan DEKA', $result['alternates']);
        $this->assertNotContains('WhatsApp DEKA', $result['alternates']);
    }

    public function test_standalone_wa_still_expands_to_contact_queries(): void
    {
        $result = $this->normalizer()->normalize('nomor wa deka');
        $queries = [$result['primary'], ...$result['alternates']];

        $this->assertContains('WhatsApp DEKA', $queries);
        $this->assertContains('nomor WhatsApp DEKA', $queries);
    }

    public function test_role_question_uses_team_queries_instead_of_previous_project_topic(): void
    {
        $result = $this->normalizer()->normalize('ui ux dideka itu saiapa', [
            ['role' => 'user', 'content' => 'proyek deka apa saja'],
            ['role' => 'assistant', 'content' => 'DEKA memiliki beberapa proyek aplikasi dan website.'],
            ['role' => 'user', 'content' => 'kak dafi role apa dideka??'],
            ['role' => 'assistant', 'content' => 'Dafi memiliki peran sebagai Web Developer di DEKA.'],
        ]);
        $queries = [$result['primary'], ...$result['alternates']];

        $this->assertSame('tim karyawan DEKA', $result['primary']);
        $this->assertContains('ui ux DEKA itu siapa', $queries);
        $this->assertNotContains('proyek DEKA', $queries);
        $this->assertNotContains('portofolio DEKA', $queries);
    }

    public function test_unknown_role_question_is_generically_routed_to_team_search(): void
    {
        $result = $this->normalizer()->normalize('backend di deka siapa');

        $this->assertSame('tim karyawan DEKA', $result['primary']);
        $this->assertContains('backend di DEKA siapa', $result['alternates']);
    }
}
