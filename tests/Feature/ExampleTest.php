<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_returns_a_successful_response(): void
    {
        $response = $this->get(route('home'));

        $response->assertOk();
    }

    public function test_assets_use_https_behind_a_trusted_proxy(): void
    {
        $response = $this->withHeaders([
            'X-Forwarded-Host' => 'example.ngrok-free.app',
            'X-Forwarded-Port' => '443',
            'X-Forwarded-Proto' => 'https',
        ])->get('/');

        $response
            ->assertOk()
            ->assertSee('https://example.ngrok-free.app/build/assets/app-', false)
            ->assertDontSee('http://example.ngrok-free.app/build/', false);
    }
}
