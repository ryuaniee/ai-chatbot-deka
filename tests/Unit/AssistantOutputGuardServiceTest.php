<?php

namespace Tests\Unit;

use App\Ai\Agents\AssistantOutputModerationAgent;
use App\Services\AssistantOutputGuardService;
use Tests\TestCase;

class AssistantOutputGuardServiceTest extends TestCase
{
    public function test_normal_reply_passes_through_unchanged(): void
    {
        $guard = app(AssistantOutputGuardService::class);

        $this->assertSame(
            'Berikut layanan yang tersedia di DEKA.',
            $guard->guard('Berikut layanan yang tersedia di DEKA.'),
        );
    }

    public function test_reply_containing_internal_markers_is_replaced_with_safe_fallback(): void
    {
        $guard = app(AssistantOutputGuardService::class);

        foreach ([
            'DEKA_KNOWLEDGE_CANDIDATES',
            'DEKA_KNOWLEDGE_SELECTION_GUIDANCE',
            'DEKA_ADMIN_APPROVED_FEEDBACK_IMPROVEMENTS',
            'BEGIN_DEKA_CANDIDATES',
            'END_DEKA_CANDIDATES',
            'BEGIN_FEEDBACK_IMPROVEMENTS',
            'END_FEEDBACK_IMPROVEMENTS',
        ] as $marker) {
            $this->assertSame(
                $guard->safeFallbackAnswer(),
                $guard->guard("Jawaban: {$marker} bocor ke user."),
                "Marker {$marker} harus memicu fallback.",
            );
        }
    }

    public function test_reply_containing_prompt_leakage_is_replaced_with_safe_fallback(): void
    {
        $guard = app(AssistantOutputGuardService::class);

        $this->assertSame(
            $guard->safeFallbackAnswer(),
            $guard->guard('2-4 sentences or short bullets? Yes (bullets allowed for contact/address questions).'),
        );
    }

    public function test_output_moderation_blocks_flagged_reply_when_enabled(): void
    {
        config()->set('services.ai_chat.moderation_enabled', true);
        config()->set('services.ai_chat.output_moderation_enabled', true);

        AssistantOutputModerationAgent::fake([[
            'allowed' => false,
            'reason_code' => 'UNSAFE_OUTPUT',
            'message' => 'Blocked.',
        ]]);

        $guard = app(AssistantOutputGuardService::class);

        $this->assertSame(
            $guard->safeFallbackAnswer(),
            $guard->guard('Konten berbahaya.'),
        );
    }

    public function test_output_moderation_allows_safe_reply_when_enabled(): void
    {
        config()->set('services.ai_chat.moderation_enabled', true);
        config()->set('services.ai_chat.output_moderation_enabled', true);

        AssistantOutputModerationAgent::fake([[
            'allowed' => true,
            'reason_code' => '',
            'message' => '',
        ]]);

        $guard = app(AssistantOutputGuardService::class);

        $this->assertSame('Jawaban aman.', $guard->guard('Jawaban aman.'));
    }

    public function test_output_moderation_is_skipped_when_disabled(): void
    {
        config()->set('services.ai_chat.moderation_enabled', true);
        config()->set('services.ai_chat.output_moderation_enabled', false);

        $guard = app(AssistantOutputGuardService::class);

        $this->assertSame('Jawaban biasa.', $guard->guard('Jawaban biasa.'));

        AssistantOutputModerationAgent::assertNotPrompted(fn (): bool => true);
    }
}
