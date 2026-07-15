<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\Conversations\ConversationResource;
use App\Models\Conversation;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

class LatestConversations extends BaseWidget
{
    protected static ?int $sort = 3;

    protected int | string | array $columnSpan = 'full';

    protected static ?string $heading = 'Percakapan Terbaru';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Conversation::query()->with('user')->withCount('messages')->latest()->take(5)
            )
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID Sesi')
                    ->formatStateUsing(fn (int $state): string => "#{$state}"),

                Tables\Columns\TextColumn::make('user.name')
                    ->label('Pengguna'),

                Tables\Columns\TextColumn::make('messages_count')
                    ->label('Jumlah Pesan')
                    ->suffix(' Pesan'),

                Tables\Columns\TextColumn::make('updated_at')
                    ->label('Aktivitas Terakhir')
                    ->since(),

                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (Conversation $record): string => 
                        $record->updated_at->gt(now()->subMinutes(10)) ? 'success' : 'gray'
                    )
                    ->formatStateUsing(fn (Conversation $record): string => 
                        $record->updated_at->gt(now()->subMinutes(10)) ? 'Sedang Aktif' : 'Tidak Aktif'
                    ),
            ])
            ->recordUrl(
                fn (Conversation $record): string => ConversationResource::getUrl('view', ['record' => $record])
            )
            ->paginated(false);
    }
}
