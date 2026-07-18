<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_redirects_to_chat()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get('/settings/profile');

        $response->assertRedirect('/chat');
    }

    public function test_profile_information_can_be_updated()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/chat')
            ->patch(route('profile.update'), [
                'name' => 'Test User',
                'email' => 'Test@Example.COM',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/chat');

        $user->refresh();

        $this->assertSame('Test User', $user->name);
        $this->assertSame('test@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
    }

    public function test_email_verification_status_is_unchanged_when_the_email_address_is_unchanged()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/chat')
            ->patch(route('profile.update'), [
                'name' => 'Test User',
                'email' => $user->email,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/chat');

        $this->assertNotNull($user->refresh()->email_verified_at);
    }

    public function test_profile_update_redirects_back_to_origin_page()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/chat')
            ->patch(route('profile.update'), [
                'name' => 'Test User',
                'email' => 'Test@Example.COM',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/chat');
    }

    public function test_user_can_delete_their_account()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->delete(route('profile.destroy'), [
                'password' => 'password',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('home'));

        $this->assertGuest();
        $this->assertNull($user->fresh());
    }

    public function test_correct_password_must_be_provided_to_delete_account()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/chat')
            ->delete(route('profile.destroy'), [
                'password' => 'wrong-password',
            ]);

        $response
            ->assertSessionHasErrors('password')
            ->assertRedirect('/chat');

        $this->assertNotNull($user->fresh());
    }
}
