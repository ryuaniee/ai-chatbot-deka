<?php

namespace App\Filament\Resources\Conversations\Schemas;

use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;

class ConversationInfolist
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Conversation')
                    ->schema([
                        TextEntry::make('id'),
                        TextEntry::make('user.name')
                            ->label('User'),
                        TextEntry::make('user.email')
                            ->label('Email'),
                        TextEntry::make('title')
                            ->placeholder('Untitled'),
                        TextEntry::make('status')
                            ->badge(),
                        TextEntry::make('last_message_at')
                            ->dateTime()
                            ->placeholder('No messages yet'),
                        TextEntry::make('created_at')
                            ->dateTime(),
                    ])
                    ->columns(2),
                Section::make('Messages')
                    ->schema([
                        RepeatableEntry::make('messages')
                            ->schema([
                                TextEntry::make('sequence'),
                                TextEntry::make('role')
                                    ->badge(),
                                TextEntry::make('content')
                                    ->columnSpanFull(),
                                TextEntry::make('created_at')
                                    ->dateTime()
                                    ->label('Created'),
                            ])
                            ->contained(false)
                            ->grid(2),
                    ]),
            ]);
    }
}
