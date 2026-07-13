<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Features;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_register_via_api(): void
    {
        $response = $this->postJson(route('api.auth.register'), [
            'name' => 'Tester API',
            'email' => 'Tester-API@Example.COM',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'tester-api@example.com')
            ->assertJsonPath('user.role', User::ROLE_USER)
            ->assertJsonPath('redirect_to', '/chat')
            ->assertJsonPath('user.requires_email_verification', true);

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'tester-api@example.com',
        ]);
    }

    public function test_guest_can_login_via_api(): void
    {
        $user = User::factory()->create([
            'email' => 'login-api@example.com',
            'password' => 'password',
        ]);

        $response = $this->postJson(route('api.auth.login'), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.role', User::ROLE_USER)
            ->assertJsonPath('redirect_to', '/chat');

        $this->assertAuthenticatedAs($user);
    }

    public function test_guest_can_login_via_api_with_uppercase_email_input(): void
    {
        $user = User::factory()->create([
            'email' => 'case-login@example.com',
            'password' => 'password',
        ]);

        $this->postJson(route('api.auth.login'), [
            'email' => 'CASE-LOGIN@EXAMPLE.COM',
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', 'case-login@example.com');

        $this->assertAuthenticatedAs($user);
    }

    public function test_authenticated_user_can_fetch_current_user_via_api(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->getJson(route('api.auth.me'))
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', User::ROLE_USER)
            ->assertJsonPath('redirect_to', '/chat')
            ->assertJsonPath('user.requires_email_verification', false);
    }

    public function test_admin_login_returns_admin_redirect_path(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin-api@example.com',
            'password' => 'password',
        ]);

        $this->postJson(route('api.auth.login'), [
            'email' => $admin->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('user.role', User::ROLE_ADMIN)
            ->assertJsonPath('redirect_to', '/admin');

        $this->assertAuthenticatedAs($admin);
    }

    public function test_login_with_two_factor_enabled_returns_challenge_instead_of_authenticating(): void
    {
        $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

        Features::twoFactorAuthentication([
            'confirm' => true,
            'confirmPassword' => true,
        ]);

        $user = User::factory()->withTwoFactor()->create([
            'email' => 'twofactor@example.com',
            'password' => 'password',
        ]);

        $this->postJson(route('api.auth.login'), [
            'email' => 'TWOFACTOR@EXAMPLE.COM',
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('two_factor', true)
            ->assertJsonPath('redirect_to', route('two-factor.login', absolute: false))
            ->assertJsonMissingPath('user.id');

        $this->assertGuest();
        $this->assertSame($user->id, session('login.id'));
    }

    public function test_authenticated_user_can_logout_via_api(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson(route('api.auth.logout'))
            ->assertOk()
            ->assertJsonPath('message', 'Logout successful.');

        $this->assertGuest();
    }

    public function test_login_with_invalid_credentials_is_rejected(): void
    {
        User::factory()->create([
            'email' => 'wrong-login@example.com',
            'password' => 'password',
        ]);

        $this->postJson(route('api.auth.login'), [
            'email' => 'wrong-login@example.com',
            'password' => 'not-the-password',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
    }

    public function test_guest_cannot_fetch_current_user_via_api(): void
    {
        $this->getJson(route('api.auth.me'))
            ->assertUnauthorized();
    }
}
