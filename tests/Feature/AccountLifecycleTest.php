<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\AccountLifecycleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AccountLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_delete_permanently_revokes_all_sessions_and_removes_user_data(): void
    {
        $user = User::factory()->create();
        DB::table('sessions')->insert([
            ['id' => 'device-one', 'user_id' => $user->id, 'ip_address' => '127.0.0.1', 'user_agent' => 'One', 'payload' => 'x', 'last_activity' => time()],
            ['id' => 'device-two', 'user_id' => $user->id, 'ip_address' => '127.0.0.2', 'user_agent' => 'Two', 'payload' => 'x', 'last_activity' => time()],
        ]);

        app(AccountLifecycleService::class)->deletePermanently($user);

        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);
    }

    public function test_original_email_can_register_again_after_permanent_delete(): void
    {
        $user = User::factory()->create(['email' => 'former@example.com']);
        app(AccountLifecycleService::class)->deletePermanently($user);

        $replacement = User::factory()->create(['email' => 'former@example.com']);
        $this->assertSame('former@example.com', $replacement->email);
    }
}
