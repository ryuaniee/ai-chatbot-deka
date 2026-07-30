<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

if ((bool) config('services.deka_knowledge.scheduled_crawl_enabled', false)) {
    Schedule::command(sprintf(
        'knowledge:crawl --limit=%d --fresh',
        max(1, (int) config('services.deka_knowledge.scheduled_crawl_limit', 50)),
    ))
        ->dailyAt((string) config('services.deka_knowledge.scheduled_crawl_time', '02:00'))
        ->withoutOverlapping()
        ->onOneServer();
}
