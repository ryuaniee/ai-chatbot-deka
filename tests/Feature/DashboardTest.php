<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_from_dashboard_alias_to_chat()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect('/chat');
    }

    public function test_authenticated_users_are_redirected_from_dashboard_to_chat()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertRedirect('/chat');
    }

    public function test_guest_is_redirected_from_admin_area_to_login(): void
    {
        $this->get(route('admin.section', 'overview'))
            ->assertRedirect(route('login'));
    }

    public function test_admin_can_access_admin_area(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->get(route('admin.section', 'overview'))
            ->assertOk();
    }

    public function test_regular_user_is_redirected_from_admin_area_to_chat(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('admin.section', 'overview'))
            ->assertRedirect('/chat');
    }

    public function test_regular_user_receives_json_forbidden_from_admin_area_when_json_expected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson(route('admin.section', 'overview'))
            ->assertForbidden()
            ->assertJsonPath('code', 'ADMIN_AREA_ACCESS_DENIED');
    }

    public function test_admin_is_redirected_from_chat_area_to_admin(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->get(route('chat'))
            ->assertRedirect('/admin');
    }

    public function test_admin_receives_json_forbidden_from_chat_api(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->getJson(route('api.conversations.index'))
            ->assertForbidden()
            ->assertJsonPath('code', 'ADMIN_ACCESS_DENIED');
    }

    public function test_regular_user_can_access_chat_area(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('chat'))
            ->assertOk();
    }
}
