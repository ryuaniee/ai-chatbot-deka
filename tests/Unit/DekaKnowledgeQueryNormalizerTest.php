<?php

namespace Tests\Unit;

use App\Services\Knowledge\DekaKnowledgeQueryNormalizer;
use PHPUnit\Framework\TestCase;

class DekaKnowledgeQueryNormalizerTest extends TestCase
{
    public function test_expands_contact_follow_up_to_deka_contact_queries(): void
    {
        $result = (new DekaKnowledgeQueryNormalizer)->normalize('kontaknya', [
            ['role' => 'assistant', 'content' => 'Kamu bisa tanya profil, layanan, proyek, founder, sejarah, atau kontak DEKA.'],
        ]);

        $this->assertSame('kontak DEKA', $result['primary']);
        $this->assertContains('alamat DEKA', $result['alternates']);
    }

    public function test_fixes_deka_typo_and_adds_contact_queries(): void
    {
        $result = (new DekaKnowledgeQueryNormalizer)->normalize('kontak deak');

        $this->assertSame('kontak DEKA', $result['primary']);
        $this->assertContains('alamat DEKA', $result['alternates']);
    }

    public function test_expands_riski_alias_to_rizky_hajar(): void
    {
        $result = (new DekaKnowledgeQueryNormalizer)->normalize('pak riski siapa deka?');

        $this->assertSame('pak Rizky siapa DEKA?', $result['primary']);
        $this->assertContains('Muhammad Rizky Hajar', $result['alternates']);
        $this->assertContains('founder DEKA', $result['alternates']);
    }

    public function test_marks_vague_person_question_as_ambiguous(): void
    {
        $result = (new DekaKnowledgeQueryNormalizer)->normalize('pak siapa di deka?');

        $this->assertTrue($result['ambiguous']);
    }
}
