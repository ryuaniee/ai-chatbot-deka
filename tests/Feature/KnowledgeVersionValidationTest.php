<?php

namespace Tests\Feature;

use App\Ai\Agents\ConversationReplyAgent;
use App\Ai\Agents\KnowledgeValidationJudgeAgent;
use App\Ai\Agents\KnowledgeValidationProbeAgent;
use App\Models\KnowledgeDocument;
use App\Models\KnowledgeDocumentVersion;
use App\Services\Knowledge\KnowledgeIngestor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Embeddings;
use Tests\TestCase;

class KnowledgeVersionValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_validated_version_atomically_replaces_previous_active_version(): void
    {
        $this->configureValidation();
        config()->set('services.deka_knowledge.validation_enabled', false);
        Embeddings::fake()->preventStrayEmbeddings();
        $ingestor = app(KnowledgeIngestor::class);
        $ingestor->ingestText('file', 'manual://versioned', str_repeat('Informasi lama DEKA. ', 5), 'Versioned');

        config()->set('services.deka_knowledge.validation_enabled', true);
        $this->fakePassingValidation();
        $result = $ingestor->ingestText(
            'file',
            'manual://versioned',
            str_repeat('Pada minggu kedua PKL, peserta membuat aplikasi chatbot. ', 3),
            'Versioned',
        );

        $this->assertSame(KnowledgeDocumentVersion::STATUS_ACTIVE, $result['status']);
        $this->assertSame(3, data_get($result, 'validation.probes_passed'));
        $this->assertDatabaseHas('knowledge_document_versions', ['version' => 1, 'status' => 'archived']);
        $this->assertDatabaseHas('knowledge_document_versions', ['version' => 2, 'status' => 'active']);
    }

    public function test_failed_validation_keeps_previous_version_active(): void
    {
        $this->configureValidation();
        config()->set('services.deka_knowledge.validation_enabled', false);
        Embeddings::fake()->preventStrayEmbeddings();
        $ingestor = app(KnowledgeIngestor::class);
        $ingestor->ingestText('file', 'manual://versioned', str_repeat('Informasi lama DEKA. ', 5), 'Versioned');

        config()->set('services.deka_knowledge.validation_enabled', true);
        $this->fakeFailingValidation();
        $result = $ingestor->ingestText(
            'file',
            'manual://versioned',
            str_repeat('Pada minggu kedua PKL, peserta membuat aplikasi chatbot. ', 3),
            'Versioned',
        );

        $document = KnowledgeDocument::query()->where('source_uri', 'manual://versioned')->firstOrFail();
        $this->assertSame(KnowledgeDocumentVersion::STATUS_FAILED, $result['status']);
        $this->assertSame(1, $document->activeVersion?->version);
        $this->assertDatabaseHas('knowledge_document_versions', ['version' => 1, 'status' => 'active']);
        $this->assertDatabaseHas('knowledge_document_versions', ['version' => 2, 'status' => 'failed']);
    }

    private function configureValidation(): void
    {
        config()->set('services.deka_knowledge.enabled', true);
        config()->set('services.deka_knowledge.retrieval_mode', 'fulltext');
        config()->set('services.deka_knowledge.query_rewrite_enabled', false);
        config()->set('services.deka_knowledge.rerank_enabled', false);
        config()->set('services.deka_knowledge.min_document_characters', 20);
        config()->set('services.deka_knowledge.validation_probe_count', 3);
    }

    private function fakePassingValidation(): void
    {
        KnowledgeValidationProbeAgent::fake([$this->probeJson()]);
        ConversationReplyAgent::fake(array_fill(0, 3, 'Peserta PKL membuat aplikasi chatbot pada minggu kedua.'));
        KnowledgeValidationJudgeAgent::fake(array_fill(0, 3, $this->judgeJson(true)));
    }

    private function fakeFailingValidation(): void
    {
        KnowledgeValidationProbeAgent::fake([$this->probeJson()]);
        ConversationReplyAgent::fake(array_fill(0, 3, 'Jawaban tidak sesuai.'));
        KnowledgeValidationJudgeAgent::fake(array_fill(0, 3, $this->judgeJson(false)));
    }

    private function probeJson(): string
    {
        return json_encode([
            'probes' => [
                ['question' => 'Apa kegiatan PKL minggu kedua?', 'required_facts' => ['membuat aplikasi chatbot']],
                ['question' => 'Tugas peserta PKL apa?', 'required_facts' => ['membuat aplikasi chatbot']],
                ['question' => 'anak pkl ngapain?', 'required_facts' => ['membuat aplikasi chatbot']],
            ],
        ], JSON_THROW_ON_ERROR);
    }

    private function judgeJson(bool $passed): string
    {
        return json_encode([
            'grounded' => $passed,
            'complete' => $passed,
            'contradiction' => ! $passed,
            'reason' => $passed ? 'Supported.' : 'Unsupported.',
        ], JSON_THROW_ON_ERROR);
    }
}
