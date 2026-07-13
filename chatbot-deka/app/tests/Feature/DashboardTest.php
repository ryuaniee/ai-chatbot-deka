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
}
