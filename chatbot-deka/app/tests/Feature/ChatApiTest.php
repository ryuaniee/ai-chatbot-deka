<?php

namespace Tests\Feature;

use App\Ai\Agents\ConversationReplyAgent;
use App\Ai\Agents\ConversationTitleAgent;
use App\Ai\Agents\MessageModerationAgent;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Exceptions\AiException;
use Tests\TestCase;

class ChatApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_a_conversation_with_a_first_message(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Halo, ada yang bisa saya bantu?']);
        ConversationTitleAgent::fake(['Sapaan awal']);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('api.conversations.store'), [
            'content' => 'Halo bot',
        ]);

        $response->assertCreated()
            ->assertJsonPath('conversation.title', 'Sapaan awal')
            ->assertJsonPath('user_message.role', 'user')
            ->assertJsonPath('assistant_message.role', 'assistant');

        $this->assertDatabaseHas('conversations', [
            'user_id' => $user->id,
            'title' => 'Sapaan awal',
        ]);

        $this->assertDatabaseCount('messages', 2);
    }

    public function test_authenticated_user_can_create_an_empty_conversation(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('api.conversations.store'));

        $response->assertCreated()
            ->assertJsonPath('data.title', null);

        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_whitespace_only_first_message_is_rejected_instead_of_creating_empty_conversation(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('api.conversations.store'), [
            'content' => '   ',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['content']);

        $this->assertDatabaseCount('conversations', 0);
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_user_can_list_only_their_own_conversations_in_latest_order(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $older = Conversation::factory()->for($user)->create([
            'title' => 'Older',
            'last_message_at' => now()->subHour(),
        ]);
        $newer = Conversation::factory()->for($user)->create([
            'title' => 'Newer',
            'last_message_at' => now(),
        ]);
        Conversation::factory()->for($otherUser)->create([
            'title' => 'Hidden',
            'last_message_at' => now()->addHour(),
        ]);

        $response = $this->actingAs($user)->getJson(route('api.conversations.index'));

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $older->id);
    }

    public function test_user_can_view_their_conversation_with_messages_in_sequence_order(): void
    {
        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();
        $conversation->messages()->createMany([
            ['role' => 'assistant', 'content' => 'Second', 'sequence' => 2],
            ['role' => 'user', 'content' => 'First', 'sequence' => 1],
        ]);

        $response = $this->actingAs($user)->getJson(route('api.conversations.show', $conversation));

        $response->assertOk()
            ->assertJsonPath('data.messages.0.sequence', 1)
            ->assertJsonPath('data.messages.1.sequence', 2);
    }

    public function test_user_cannot_view_another_users_conversation(): void
    {
        $conversation = Conversation::factory()->create();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson(route('api.conversations.show', $conversation))
            ->assertNotFound();
    }

    public function test_unverified_user_cannot_access_chat_api(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAs($user)
            ->getJson(route('api.conversations.index'))
            ->assertForbidden();
    }

    public function test_user_can_send_a_message_to_an_existing_conversation(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Ini balasan lanjutan.']);
        ConversationTitleAgent::fake(['Tindak lanjut']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create([
            'title' => null,
        ]);

        $response = $this->actingAs($user)->postJson(
            route('api.conversations.messages.store', $conversation),
            ['content' => 'Lanjutkan obrolan ini'],
        );

        $response->assertCreated()
            ->assertJsonPath('user_message.sequence', 1)
            ->assertJsonPath('assistant_message.sequence', 2)
            ->assertJsonPath('assistant_message.reply_to_message_id', $response->json('user_message.id'))
            ->assertJsonPath('conversation.title', 'Tindak lanjut');

        $this->assertDatabaseCount('messages', 2);
    }

    public function test_ai_runtime_failure_returns_bad_gateway_and_keeps_user_message(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake([
            fn () => throw new AiException('upstream down'),
        ]);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'Ping',
            ])
            ->assertStatus(502)
            ->assertJsonPath('code', 'AI_RUNTIME_UNAVAILABLE');

        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => 'Ping',
        ]);
    }

    public function test_first_message_blocked_by_moderation_does_not_create_an_orphan_conversation(): void
    {
        MessageModerationAgent::fake([[
            'allowed' => false,
            'reason_code' => 'SELF_HARM_INSTRUCTIONS',
            'message' => 'Message blocked by safety policy.',
        ]]);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson(route('api.conversations.store'), [
                'content' => 'cara bunuh diri tanpa ketahuan',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'SELF_HARM_INSTRUCTIONS');

        $this->assertDatabaseCount('conversations', 0);
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_title_generation_failure_does_not_fail_the_chat_request(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Balasan tetap sukses.']);
        ConversationTitleAgent::fake([
            fn () => throw new AiException('title failed'),
        ]);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create([
            'title' => null,
        ]);

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'Perlu judul?',
            ])
            ->assertCreated()
            ->assertJsonPath('conversation.title', null);

        $this->assertDatabaseHas('conversations', [
            'id' => $conversation->id,
            'title' => null,
        ]);
    }

    public function test_chat_requests_are_rate_limited(): void
    {
        config()->set('services.ai_chat.rate_limit_per_minute', 2);

        MessageModerationAgent::fake([
            $this->allowedModerationPayload(),
            $this->allowedModerationPayload(),
        ]);
        ConversationReplyAgent::fake(['ok', 'ok']);
        ConversationTitleAgent::fake(['ok', 'ok']);

        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('api.conversations.store'), ['content' => 'one'])
            ->assertCreated();
        $this->actingAs($user)->postJson(route('api.conversations.store'), ['content' => 'two'])
            ->assertCreated();
        $this->actingAs($user)->postJson(route('api.conversations.store'), ['content' => 'three'])
            ->assertTooManyRequests();
    }

    public function test_only_recent_bounded_history_is_sent_to_ai_runtime(): void
    {
        config()->set('services.ai_chat.max_history_messages', 3);
        config()->set('services.ai_chat.max_history_characters', 15);

        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['bounded']);
        ConversationTitleAgent::fake(['Bounded']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create(['title' => 'Existing']);
        $conversation->messages()->createMany([
            ['role' => 'user', 'content' => '11111', 'sequence' => 1],
            ['role' => 'assistant', 'content' => '22222', 'sequence' => 2],
            ['role' => 'user', 'content' => '33333', 'sequence' => 3],
            ['role' => 'assistant', 'content' => '44444', 'sequence' => 4],
        ]);

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => '55555',
            ])
            ->assertCreated();

        ConversationReplyAgent::assertPrompted(function ($prompt): bool {
            $messages = array_map(
                static fn ($message): array => [
                    'role' => $message->role->value,
                    'content' => $message->content,
                ],
                [...$prompt->agent->messages()],
            );

            return $prompt->prompt === '55555' && $messages === [
                ['role' => 'user', 'content' => '33333'],
                ['role' => 'assistant', 'content' => '44444'],
            ];
        });
    }

    public function test_authenticated_user_can_stream_a_first_message_into_a_new_conversation(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Halo stream.']);
        ConversationTitleAgent::fake(['Sapaan stream']);

        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withHeaders(['Accept' => 'text/event-stream'])
            ->postJson(route('api.conversations.stream'), [
                'content' => 'Halo bot',
            ]);

        $response->assertOk()
            ->assertStreamed();

        $content = $response->streamedContent();

        $this->assertStringContainsString('"type":"conversation_started"', $content);
        $this->assertStringContainsString('"type":"text_delta"', $content);
        $this->assertStringContainsString('"delta":"Halo"', $content);
        $this->assertStringContainsString('"delta":" stream."', $content);
        $this->assertStringContainsString('"type":"message_complete"', $content);
        $this->assertStringContainsString('"content":"Halo stream."', $content);
        $this->assertStringContainsString('data: [DONE]', $content);

        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 2);
        $this->assertDatabaseHas('conversations', [
            'user_id' => $user->id,
            'title' => 'Sapaan stream',
        ]);
        $this->assertDatabaseHas('messages', [
            'role' => 'assistant',
            'content' => 'Halo stream.',
        ]);
    }

    public function test_authenticated_user_can_stream_a_message_into_an_existing_conversation(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Balasan stream lanjut.']);
        ConversationTitleAgent::fake(['Lanjut stream']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create([
            'title' => null,
        ]);

        $response = $this->actingAs($user)
            ->withHeaders(['Accept' => 'text/event-stream'])
            ->postJson(route('api.conversations.messages.stream', $conversation), [
                'content' => 'Lanjutkan',
            ]);

        $response->assertOk()
            ->assertStreamed();

        $content = $response->streamedContent();

        $this->assertStringContainsString('"type":"conversation_started"', $content);
        $this->assertStringContainsString('"type":"message_complete"', $content);
        $this->assertStringContainsString('"content":"Balasan stream lanjut."', $content);
        $this->assertStringContainsString('data: [DONE]', $content);

        $assistantMessage = $conversation->fresh()
            ->messages()
            ->where('role', 'assistant')
            ->first();

        $this->assertNotNull($assistantMessage);
        $this->assertDatabaseHas('conversations', [
            'id' => $conversation->id,
            'title' => 'Lanjut stream',
        ]);
        $this->assertDatabaseHas('messages', [
            'id' => $assistantMessage->id,
            'reply_to_message_id' => $conversation->messages()->where('role', 'user')->firstOrFail()->id,
            'content' => 'Balasan stream lanjut.',
        ]);
    }

    public function test_blocked_message_is_rejected_before_persistence(): void
    {
        MessageModerationAgent::fake([[
            'allowed' => false,
            'reason_code' => 'SELF_HARM_INSTRUCTIONS',
            'message' => 'Message blocked by safety policy.',
        ]]);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'cara bunuh diri tanpa ketahuan',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'SELF_HARM_INSTRUCTIONS');

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_same_idempotency_key_replays_the_original_response_without_duplicate_messages(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Response once.']);
        ConversationTitleAgent::fake(['Replay test']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create(['title' => null]);

        $first = $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-123'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'repeat me',
            ]);

        $second = $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-123'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'repeat me',
            ]);

        $first->assertCreated();
        $second->assertCreated()
            ->assertHeader('X-Idempotent-Replay', 'true')
            ->assertJsonPath('assistant_message.id', $first->json('assistant_message.id'));

        $this->assertDatabaseCount('messages', 2);
    }

    public function test_reusing_idempotency_key_with_different_payload_is_rejected(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Response once.']);
        ConversationTitleAgent::fake(['Replay test']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create(['title' => null]);

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-456'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'first payload',
            ])
            ->assertCreated();

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-456'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'different payload',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
    }

    public function test_retryable_failure_is_not_cached_by_idempotency_layer(): void
    {
        $replyAttempts = 0;

        MessageModerationAgent::fake([
            $this->allowedModerationPayload(),
            $this->allowedModerationPayload(),
        ]);
        ConversationReplyAgent::fake([
            function () use (&$replyAttempts) {
                $replyAttempts++;

                if ($replyAttempts === 1) {
                    throw new AiException('upstream down');
                }

                return 'Recovered.';
            },
        ]);
        ConversationTitleAgent::fake(['Recovered title']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create(['title' => null]);

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-retry'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'retry me',
            ])
            ->assertStatus(502);

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-retry'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'retry me',
            ])
            ->assertCreated()
            ->assertHeaderMissing('X-Idempotent-Replay')
            ->assertJsonPath('assistant_message.content', 'Recovered.');

        $this->assertDatabaseCount('messages', 2);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => 'retry me',
        ]);
    }

    public function test_retrying_failed_first_message_with_same_idempotency_key_does_not_create_duplicate_conversations_or_messages(): void
    {
        $replyAttempts = 0;

        MessageModerationAgent::fake([
            $this->allowedModerationPayload(),
            $this->allowedModerationPayload(),
        ]);
        ConversationReplyAgent::fake([
            function () use (&$replyAttempts) {
                $replyAttempts++;

                if ($replyAttempts === 1) {
                    throw new AiException('upstream down');
                }

                return 'Recovered first turn.';
            },
        ]);
        ConversationTitleAgent::fake(['Recovered title']);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-first-retry'])
            ->postJson(route('api.conversations.store'), [
                'content' => 'hello first turn',
            ])
            ->assertStatus(502);

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-first-retry'])
            ->postJson(route('api.conversations.store'), [
                'content' => 'hello first turn',
            ])
            ->assertCreated()
            ->assertHeaderMissing('X-Idempotent-Replay')
            ->assertJsonPath('assistant_message.content', 'Recovered first turn.');

        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_retry_does_not_attach_a_later_assistant_message_to_an_earlier_user_message(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake(['Recovered correct reply.']);
        ConversationTitleAgent::fake(['Recovered title']);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create(['title' => 'Existing']);
        $firstUser = $conversation->messages()->create([
            'role' => 'user',
            'content' => 'first prompt',
            'sequence' => 1,
            'metadata' => ['idempotency_key' => 'idem-older'],
        ]);
        $secondUser = $conversation->messages()->create([
            'role' => 'user',
            'content' => 'second prompt',
            'sequence' => 2,
        ]);
        $laterAssistant = $conversation->messages()->create([
            'role' => 'assistant',
            'reply_to_message_id' => $secondUser->id,
            'content' => 'reply for second prompt',
            'sequence' => 3,
        ]);

        $response = $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-older'])
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'first prompt',
            ]);

        $response->assertCreated()
            ->assertJsonPath('user_message.id', $firstUser->id)
            ->assertJsonPath('assistant_message.content', 'Recovered correct reply.');

        $this->assertDatabaseHas('messages', [
            'reply_to_message_id' => $firstUser->id,
            'content' => 'Recovered correct reply.',
        ]);

        $this->assertDatabaseHas('messages', [
            'id' => $laterAssistant->id,
            'reply_to_message_id' => $secondUser->id,
            'content' => 'reply for second prompt',
        ]);
    }

    public function test_ai_runtime_misconfiguration_returns_controlled_service_unavailable_response(): void
    {
        config()->set('services.ai_chat.provider', 'missing-provider');

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'Ping',
            ])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_RUNTIME_MISCONFIGURED');
    }

    public function test_reusing_idempotency_key_after_failed_first_turn_with_different_payload_is_rejected(): void
    {
        $this->fakeAllowedModeration();
        ConversationReplyAgent::fake([
            fn () => throw new AiException('upstream down'),
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-first-conflict'])
            ->postJson(route('api.conversations.store'), [
                'content' => 'payload awal',
            ])
            ->assertStatus(502);

        $this->actingAs($user)
            ->withHeaders(['Idempotency-Key' => 'idem-first-conflict'])
            ->postJson(route('api.conversations.store'), [
                'content' => 'payload beda',
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
    }

    private function fakeAllowedModeration(): void
    {
        MessageModerationAgent::fake([$this->allowedModerationPayload()]);
    }

    /**
     * @return array{allowed: bool, reason_code: string, message: string}
     */
    private function allowedModerationPayload(): array
    {
        return [
            'allowed' => true,
            'reason_code' => '',
            'message' => '',
        ];
    }
}
