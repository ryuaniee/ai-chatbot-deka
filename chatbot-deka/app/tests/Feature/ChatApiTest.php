<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ChatApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_a_conversation_with_a_first_message(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Halo, ada yang bisa saya bantu?',
                ],
                'usage' => ['total_tokens' => 12],
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Sapaan awal',
            ]),
        ]);

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
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Ini balasan lanjutan.',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Tindak lanjut',
            ]),
        ]);

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

    public function test_ai_service_failure_returns_bad_gateway_and_keeps_user_message(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response(['message' => 'nope'], 500),
        ]);

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'Ping',
            ])
            ->assertStatus(502)
            ->assertJsonPath('code', 'AI_SERVICE_UNAVAILABLE');

        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => 'Ping',
        ]);
    }

    public function test_first_message_blocked_by_moderation_does_not_create_an_orphan_conversation(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => false,
                'reason_code' => 'SELF_HARM_INSTRUCTIONS',
                'message' => 'Message blocked by safety policy.',
            ]),
        ]);

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
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Balasan tetap sukses.',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([], 500),
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
        config()->set('services.ai_service.rate_limit_per_minute', 2);

        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'ok',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'ok',
            ]),
        ]);

        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('api.conversations.store'), ['content' => 'one'])
            ->assertCreated();
        $this->actingAs($user)->postJson(route('api.conversations.store'), ['content' => 'two'])
            ->assertCreated();
        $this->actingAs($user)->postJson(route('api.conversations.store'), ['content' => 'three'])
            ->assertTooManyRequests();
    }

    public function test_only_recent_bounded_history_is_sent_to_ai_service(): void
    {
        config()->set('services.ai_service.max_history_messages', 3);
        config()->set('services.ai_service.max_history_characters', 15);

        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'bounded',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Bounded',
            ]),
        ]);

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

        Http::assertSent(function ($request): bool {
            if ($request->url() !== 'http://127.0.0.1:8001/chat/respond') {
                return false;
            }

            $messages = $request['messages'];

            return $messages === [
                ['role' => 'user', 'content' => '33333'],
                ['role' => 'assistant', 'content' => '44444'],
                ['role' => 'user', 'content' => '55555'],
            ];
        });
    }

    public function test_blocked_message_is_rejected_before_persistence(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => false,
                'reason_code' => 'SELF_HARM_INSTRUCTIONS',
                'message' => 'Message blocked by safety policy.',
            ]),
        ]);

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
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Response once.',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Replay test',
            ]),
        ]);

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
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Response once.',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Replay test',
            ]),
        ]);

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
        Http::fakeSequence()
            ->push([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ])
            ->push(['message' => 'upstream down'], 500)
            ->push([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ])
            ->push([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Recovered.',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ])
            ->push([
                'title' => 'Recovered title',
            ]);

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
        $respondAttempts = 0;

        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => function () use (&$respondAttempts) {
                $respondAttempts++;

                if ($respondAttempts === 1) {
                    return Http::response(['message' => 'upstream down'], 500);
                }

                return Http::response([
                    'message' => [
                        'role' => 'assistant',
                        'content' => 'Recovered first turn.',
                    ],
                    'usage' => null,
                    'model' => 'gpt-4o-mini',
                ]);
            },
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Recovered title',
            ]),
        ]);

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
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'Recovered correct reply.',
                ],
                'usage' => null,
                'model' => 'gpt-4o-mini',
            ]),
            'http://127.0.0.1:8001/chat/title' => Http::response([
                'title' => 'Recovered title',
            ]),
        ]);

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

    public function test_ai_service_misconfiguration_returns_controlled_service_unavailable_response(): void
    {
        config()->set('services.ai_service.internal_token', 'change-this-in-production');

        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.store', $conversation), [
                'content' => 'Ping',
            ])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_SERVICE_MISCONFIGURED');
    }

    public function test_reusing_idempotency_key_after_failed_first_turn_with_different_payload_is_rejected(): void
    {
        Http::fake([
            'http://127.0.0.1:8001/chat/moderate' => Http::response([
                'allowed' => true,
                'reason_code' => null,
                'message' => null,
            ]),
            'http://127.0.0.1:8001/chat/respond' => Http::response(['message' => 'upstream down'], 500),
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
}
