<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageFeedback;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminDashboardBackendTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_overview_receives_database_backed_dashboard_props(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-20 10:00:00'));

        $admin = User::factory()->admin()->create(['name' => 'Admin Deka']);
        $user = User::factory()->create(['name' => 'Nadia Putri', 'email' => 'nadia@example.com']);
        $conversation = Conversation::factory()->for($user)->create([
            'title' => 'Harga layanan',
            'status' => 'closed',
            'last_message_at' => now(),
        ]);
        $assistantMessage = Message::query()->create([
            'conversation_id' => $conversation->id,
            'role' => 'assistant',
            'sequence' => 2,
            'content' => 'Jawaban Deka.',
            'created_at' => now(),
            'metadata' => [
                'model' => 'gpt-test',
                'usage' => [
                    'prompt_tokens' => 120,
                    'completion_tokens' => 80,
                    'total_tokens' => 200,
                ],
            ],
        ]);

        MessageFeedback::query()->create([
            'message_id' => $assistantMessage->id,
            'user_id' => $user->id,
            'type' => MessageFeedback::TYPE_LIKE,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.section', 'overview'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin')
                ->where('section', 'overview')
                ->has('metrics', 4)
                ->where('tokenUsageItems.0.email', 'nadia@example.com')
                ->where('tokenUsageItems.0.totalTokens', 200)
                ->has('tokenTrendItems', 30)
                ->where('tokenTrendItems.29.date', '2026-07-20')
                ->where('tokenTrendItems.29.promptTokens', 120)
                ->where('tokenTrendItems.29.completionTokens', 80)
                ->where('tokenTrendItems.29.totalTokens', 200)
                ->where('tokenTrendItems.29.requests', 1)
                ->has('roleItems', 2)
                ->where('roleItems.0.slug', 'admin')
                ->where('roleItems.0.usersCount', 1)
                ->where('roleItems.1.slug', 'user')
                ->where('roleItems.1.usersCount', 1)
                ->has('chatTrendItems', 90)
                ->has('feedbackChartItems', 6)
                ->where('totals.totalLikes', 1));

        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_user_id' => $admin->id,
            'action' => 'Membuka Dashboard Ringkasan',
            'target' => 'Menu admin',
        ]);

        Carbon::setTestNow();
    }

    public function test_admin_conversations_section_is_not_available(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->get(route('admin.section', 'conversations'))
            ->assertNotFound();
    }

    public function test_admin_activity_log_can_be_searched_and_period_filtered(): void
    {
        $now = Carbon::parse('2026-07-20 10:00:00');
        Carbon::setTestNow($now);

        $admin = User::factory()->admin()->create(['name' => 'Admin Deka']);

        $recentLog = AdminActivityLog::query()->create([
            'admin_user_id' => $admin->id,
            'category' => 'report',
            'action' => 'Export laporan bulanan',
            'target' => 'Feedback AI',
            'description' => 'Audit Mingguan khusus',
            'ip_address' => '127.0.0.1',
        ]);
        $recentLog->forceFill([
            'created_at' => $now->copy()->subDays(3),
            'updated_at' => $now->copy()->subDays(3),
        ])->save();

        $oldLog = AdminActivityLog::query()->create([
            'admin_user_id' => $admin->id,
            'category' => 'report',
            'action' => 'Export laporan lama',
            'target' => 'Feedback AI',
            'description' => 'Audit Mingguan lama',
            'ip_address' => '127.0.0.2',
        ]);
        $oldLog->forceFill([
            'created_at' => $now->copy()->subDays(20),
            'updated_at' => $now->copy()->subDays(20),
        ])->save();

        try {
            $this->actingAs($admin)
                ->get(route('admin.section', [
                    'section' => 'activity-log',
                    'search' => 'Audit Mingguan',
                    'period' => 'week',
                ]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->where('section', 'activity-log')
                    ->where('filters.search', 'Audit Mingguan')
                    ->where('filters.period', 'week')
                    ->has('adminActivityItems', 1)
                    ->where('adminActivityItems.0.action', 'Export laporan bulanan')
                    ->where('adminActivityItems.0.category', 'report'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_admin_activity_log_normalizes_unknown_categories(): void
    {
        $admin = User::factory()->admin()->create();

        AdminActivityLog::query()->create([
            'admin_user_id' => $admin->id,
            'category' => 'custom-category',
            'action' => 'Custom action',
            'target' => 'Custom target',
            'description' => 'Kategori lama dari data historis.',
            'ip_address' => '127.0.0.1',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.section', [
                'section' => 'activity-log',
                'search' => 'Custom action',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('adminActivityItems', 1)
                ->where('adminActivityItems.0.category', 'system')
                ->where('adminActivityItems.0.action', 'Custom action'));
    }

    public function test_admin_activity_log_realtime_endpoint_does_not_create_visit_logs(): void
    {
        $admin = User::factory()->admin()->create();

        AdminActivityLog::query()->create([
            'admin_user_id' => $admin->id,
            'category' => 'system',
            'action' => 'Membuka Log Aktivitas',
            'target' => 'Menu admin',
            'description' => 'Admin membuka menu Log Aktivitas.',
            'ip_address' => '127.0.0.1',
        ]);

        $this->actingAs($admin)
            ->getJson(route('admin.activity-log.items', ['period' => 'month']))
            ->assertOk()
            ->assertJsonCount(1, 'adminActivityItems')
            ->assertJsonPath('adminActivityItems.0.action', 'Membuka Log Aktivitas')
            ->assertJsonPath('filters.period', 'month');

        $this->assertDatabaseCount('admin_activity_logs', 1);
    }

    public function test_admin_can_log_activity_export_for_excel(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson(route('admin.activity-log.export-log'), [
                'format' => 'Excel',
                'period' => 'month',
                'item_count' => 12,
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Export activity logged.');

        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_user_id' => $admin->id,
            'category' => 'report',
            'action' => 'Export log aktivitas Excel',
            'target' => 'Laporan Log Aktivitas',
        ]);
    }

    public function test_user_can_persist_and_clear_assistant_message_feedback(): void
    {
        $user = User::factory()->create();
        $conversation = Conversation::factory()->for($user)->create();
        $assistantMessage = Message::query()->create([
            'conversation_id' => $conversation->id,
            'role' => 'assistant',
            'sequence' => 1,
            'content' => 'Jawaban Deka.',
        ]);

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.feedback', [$conversation, $assistantMessage]), [
                'type' => MessageFeedback::TYPE_DISLIKE,
            ])
            ->assertOk()
            ->assertJsonPath('data.type', MessageFeedback::TYPE_DISLIKE);

        $this->assertDatabaseHas('message_feedback', [
            'message_id' => $assistantMessage->id,
            'user_id' => $user->id,
            'type' => MessageFeedback::TYPE_DISLIKE,
        ]);

        $this->actingAs($user)
            ->postJson(route('api.conversations.messages.feedback', [$conversation, $assistantMessage]), [
                'type' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.type', null);

        $this->assertDatabaseMissing('message_feedback', [
            'message_id' => $assistantMessage->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_user_cannot_submit_feedback_for_another_users_message(): void
    {
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $conversation = Conversation::factory()->for($owner)->create();
        $assistantMessage = Message::query()->create([
            'conversation_id' => $conversation->id,
            'role' => 'assistant',
            'sequence' => 1,
            'content' => 'Jawaban Deka.',
        ]);

        $this->actingAs($otherUser)
            ->postJson(route('api.conversations.messages.feedback', [$conversation, $assistantMessage]), [
                'type' => MessageFeedback::TYPE_LIKE,
            ])
            ->assertNotFound();

        $this->assertDatabaseMissing('message_feedback', [
            'message_id' => $assistantMessage->id,
            'user_id' => $otherUser->id,
        ]);
    }
}
