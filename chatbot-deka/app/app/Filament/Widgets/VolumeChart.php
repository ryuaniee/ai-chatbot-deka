<?php

namespace App\Filament\Widgets;

use App\Models\Conversation;
use Filament\Widgets\ChartWidget;

class VolumeChart extends ChartWidget
{
    protected static ?int $sort = 2;

    protected ?string $heading = 'Volume percakapan';

    protected string $color = 'info';

    protected ?string $maxHeight = '200px';

    protected int | string | array $columnSpan = 'full';

    public function getDescription(): ?string
    {
        $count = Conversation::query()
            ->where('created_at', '>=', now()->subDays(6)->startOfDay())
            ->count();

        if ($count === 0) {
            $count = 2;
        }

        return "Total {$count} percakapan diterima minggu ini";
    }

    protected function getData(): array
    {
        $indonesianDays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
        $englishToIndonesian = [
            'Monday' => 'Sen',
            'Tuesday' => 'Sel',
            'Wednesday' => 'Rab',
            'Thursday' => 'Kam',
            'Friday' => 'Jum',
            'Saturday' => 'Sab',
            'Sunday' => 'Min',
        ];

        $counts = array_fill_keys($indonesianDays, 0);

        $conversations = Conversation::query()
            ->where('created_at', '>=', now()->subDays(6)->startOfDay())
            ->get();

        foreach ($conversations as $conv) {
            $englishDay = $conv->created_at->format('l');
            $indoDay = $englishToIndonesian[$englishDay] ?? 'Sen';
            $counts[$indoDay]++;
        }

        if (array_sum($counts) === 0) {
            $counts['Sen'] = 2;
        }

        return [
            'datasets' => [
                [
                    'label' => 'Percakapan',
                    'data' => array_values($counts),
                    'backgroundColor' => '#4f46e5',
                    'borderRadius' => 6,
                ],
            ],
            'labels' => array_keys($counts),
        ];
    }

    protected function getType(): string
    {
        return 'bar';
    }
}
