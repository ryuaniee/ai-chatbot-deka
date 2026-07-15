<?php

namespace App\Filament\Widgets;

use App\Models\Conversation;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        return [
            Stat::make('Total percakapan', Conversation::count()),
            Stat::make('Total suka', 1),
            Stat::make('Total tidak suka', 1),
            Stat::make('Total pengguna', \App\Models\User::count()),
        ];
    }
}
