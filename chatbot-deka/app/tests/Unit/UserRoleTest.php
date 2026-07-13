<?php

namespace Tests\Unit;

use App\Models\User;
use Filament\Panel;
use Mockery;
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

    public function test_only_admin_can_access_admin_panel(): void
    {
        $panel = Mockery::mock(Panel::class);
        $panel->shouldReceive('getId')->andReturn('admin');

        $user = new User(['role' => User::ROLE_USER]);
        $admin = new User(['role' => User::ROLE_ADMIN]);

        $this->assertFalse($user->canAccessPanel($panel));
        $this->assertTrue($admin->canAccessPanel($panel));
    }
}
