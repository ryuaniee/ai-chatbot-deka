<?php

namespace App\Filament\Pages;

use Filament\Actions\Action;
use Filament\Pages\Dashboard as BaseDashboard;
use Filament\Support\Enums\IconPosition;

class Dashboard extends BaseDashboard
{
    protected static ?string $title = 'Ringkasan';

    protected static ?string $navigationLabel = 'Ringkasan';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-squares-2x2';

    protected static string | \UnitEnum | null $navigationGroup = 'WORKSPACE';

    protected function getHeaderActions(): array
    {
        return [
            Action::make('date_filter')
                ->label('7 hari terakhir')
                ->color('gray')
                ->icon('heroicon-m-chevron-down')
                ->iconPosition(IconPosition::After)
                ->url('#'),

            Action::make('add_content')
                ->label('Tambah konten')
                ->icon('heroicon-o-plus')
                ->color('primary')
                ->url('#'),
        ];
    }
}
