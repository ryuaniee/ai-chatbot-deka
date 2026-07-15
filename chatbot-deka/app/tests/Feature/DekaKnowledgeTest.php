<?php

namespace Tests\Feature;

use App\Ai\Agents\ConversationReplyAgent;
use App\Ai\Agents\ConversationTitleAgent;
use App\Ai\Agents\MessageModerationAgent;
use App\Models\KnowledgeDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Exceptions\AiException;
use Tests\TestCase;

class DekaKnowledgeTest extends TestCase
{
    use RefreshDatabase;

    public function test_ingest_command_stores_deka_pages_as_chunks(): void
    {
        Http::fake([
            'https://deka.dev/sitemap.xml' => Http::response(
                '<urlset><url><loc>https://deka.dev/docs</loc></url></urlset>',
                200,
                ['content-type' => 'application/xml'],
            ),
            'https://deka.dev/docs' => Http::response(
                '<html><head><title>Deka Docs</title></head><body><nav>Menu</nav><main><h1>Deka Docs</h1><p>Deka adalah chatbot internal untuk membantu siswa memahami layanan sekolah dan dokumentasi teknis. Konten ini cukup panjang agar masuk ke knowledge chunk dan bisa dicari oleh retriever backend.</p></main><footer>Footer</footer></body></html>',
                200,
                ['content-type' => 'text/html'],
            ),
        ]);

        $this->artisan('deka:knowledge:ingest', [
            '--url' => 'https://deka.dev',
            '--limit' => 5,
            '--fresh' => true,
        ])->assertSuccessful();

        $this->assertDatabaseHas('knowledge_documents', [
            'url' => 'https://deka.dev/docs',
            'title' => 'Deka Docs',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('knowledge_chunks', [
            'chunk_index' => 0,
        ]);
        $this->assertDatabaseHas('knowledge_ingestion_runs', [
            'base_url' => 'https://deka.dev',
            'status' => 'completed',
            'pages_seen' => 1,
            'pages_stored' => 1,
        ]);
    }

    public function test_in_context_chat_injects_deka_knowledge_before_calling_ai(): void
    {
        config()->set('services.deka_knowledge.enabled', true);
        config()->set('services.deka_knowledge.min_score', 0.0);

        $this->seedKnowledgeChunk('Deka adalah chatbot internal untuk informasi sekolah dan dokumentasi teknis.');
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Deka adalah chatbot internal.']);
        ConversationTitleAgent::fake(['Tentang Deka']);

        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('api.conversations.store'), [
            'content' => 'Apa itu chatbot Deka?',
        ])->assertCreated()
            ->assertJsonPath('assistant_message.content', 'Deka adalah chatbot internal.')
            ->assertJsonPath('assistant_message.metadata.knowledge.in_context', true)
            ->assertJsonPath('assistant_message.metadata.knowledge.sources.0.url', 'https://deka.dev/docs');

        ConversationReplyAgent::assertPrompted(function ($prompt): bool {
            return $prompt->prompt === 'Apa itu chatbot Deka?'
                && str_contains((string) $prompt->agent->instructions(), 'DEKA_CONTEXT')
                && str_contains((string) $prompt->agent->instructions(), 'https://deka.dev/docs');
        });
    }

    public function test_out_of_context_chat_returns_immediately_without_calling_ai(): void
    {
        config()->set('services.deka_knowledge.enabled', true);
        config()->set('services.deka_knowledge.min_score', 0.0);

        $this->seedKnowledgeChunk('Deka hanya berisi informasi chatbot internal dan dokumentasi teknis.');
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake([
            fn () => throw new AiException('AI should not be called for out-of-context questions.'),
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('api.conversations.store'), [
            'content' => 'Siapa presiden Brasil?',
        ])->assertCreated()
            ->assertJsonPath('conversation.title', null)
            ->assertJsonPath('assistant_message.content', config('services.deka_knowledge.out_of_context_response'))
            ->assertJsonPath('assistant_message.metadata.out_of_context', true)
            ->assertJsonPath('assistant_message.metadata.knowledge.in_context', false);

        $this->assertDatabaseCount('messages', 2);
    }

    private function seedKnowledgeChunk(string $content): void
    {
        $document = KnowledgeDocument::query()->create([
            'url' => 'https://deka.dev/docs',
            'title' => 'Deka Docs',
            'content_hash' => hash('sha256', $content),
            'status' => 'active',
            'crawled_at' => now(),
        ]);

        $document->chunks()->create([
            'chunk_index' => 0,
            'content' => $content,
        ]);
    }

    private function fakeAllowedModeration(): void
    {
        MessageModerationAgent::fake([[
            'allowed' => true,
            'reason_code' => '',
            'message' => '',
        ]]);
    }
}
