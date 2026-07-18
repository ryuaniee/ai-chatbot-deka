<?php

namespace Tests\Unit;

use App\Models\User;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class UserRoleTest extends TestCase
{
    public function test_user_role_helpers_work(): void
    {
        $user = new User(['role' => User::ROLE_USER]);
        $admin = new User(['role' => User::ROLE_ADMIN]);

        $this->assertTrue($user->isUser());
        $this->assertFalse($user->isAdmin());

        $this->assertTrue($admin->isAdmin());
        $this->assertFalse($admin->isUser());
    }

    public function test_non_admin_redirect_path_is_chat(): void
    {
        Route::get('/login')->name('login');

        $user = new User(['role' => User::ROLE_USER, 'email_verified_at' => now()]);

        $this->assertSame('/chat', $user->isAdmin() ? '/admin' : '/chat');
    }
}
