<?php

namespace Tests\Unit;

use App\Support\EmailAddress;
use PHPUnit\Framework\TestCase;

class EmailAddressTest extends TestCase
{
    public function test_normalizes_email_case_and_whitespace(): void
    {
        $this->assertSame('user@example.com', EmailAddress::normalize('  User@Example.COM  '));
    }

    public function test_canonicalizes_gmail_dot_plus_and_googlemail_aliases(): void
    {
        $this->assertSame('username@gmail.com', EmailAddress::canonical('user.name+2@googlemail.com'));
        $this->assertSame('username@gmail.com', EmailAddress::canonical('u.s.e.r.n.a.m.e@gmail.com'));
    }

    public function test_canonicalizes_plus_alias_for_other_domains_without_removing_dots(): void
    {
        $this->assertSame('first.last@example.com', EmailAddress::canonical('first.last+tag@example.com'));
    }
}
