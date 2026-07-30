import { MessageSquare } from 'lucide-react';
import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const chartConfig = {
    conversations: {
        label: 'Masuk',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

type ConversationChartItem = {
    date: string;
    conversations: number;
};

function aggregateConversationData(
    items: ConversationChartItem[],
    timeRange: string,
) {
    if (timeRange === '7d') {
        return items;
    }

    const groupedItems = new Map<string, ConversationChartItem>();

    items.forEach((item) => {
        const date = new Date(item.date);
        const groupDate = new Date(date);

        if (timeRange === '90d') {
            groupDate.setDate(1);
        } else {
            const day = groupDate.getDay();
            const daysSinceMonday = day === 0 ? 6 : day - 1;
            groupDate.setDate(groupDate.getDate() - daysSinceMonday);
        }

        const key = groupDate.toISOString().slice(0, 10);
        const groupedItem = groupedItems.get(key);

        groupedItems.set(key, {
            date: key,
            conversations:
                (groupedItem?.conversations ?? 0) + item.conversations,
        });
    });

    return Array.from(groupedItems.values()).sort(
        (firstItem, secondItem) =>
            new Date(firstItem.date).getTime() -
            new Date(secondItem.date).getTime(),
    );
}

function formatConversationDate(value: string, timeRange: string) {
    const date = new Date(value);

    return date.toLocaleDateString('id-ID', {
        month: 'short',
        ...(timeRange === '90d' ? {} : { day: 'numeric' }),
    });
}

export function AdminConversationChart({
    chartClassName,
    className,
    data,
}: {
    chartClassName?: string;
    className?: string;
    data: ConversationChartItem[];
}) {
    const [timeRange, setTimeRange] = React.useState('90d');
    const referenceDate = data.reduce((latest, item) => {
        const itemDate = new Date(item.date);

        return itemDate > latest ? itemDate : latest;
    }, new Date());

    const filteredData = data.filter((item) => {
        const date = new Date(item.date);
        let daysToSubtract = 90;

        if (timeRange === '30d') {
            daysToSubtract = 30;
        } else if (timeRange === '7d') {
            daysToSubtract = 7;
        }

        const startDate = new Date(referenceDate);
        startDate.setDate(startDate.getDate() - daysToSubtract);

        return date >= startDate;
    });
    const chartData = aggregateConversationData(filteredData, timeRange);
    const hasConversationData = chartData.some(
        (item) => item.conversations > 0,
    );
    const totalConversations = chartData.reduce(
        (total, item) => total + item.conversations,
        0,
    );
    const peakItem = chartData.reduce<ConversationChartItem | null>(
        (peak, item) =>
            !peak || item.conversations > peak.conversations ? item : peak,
        null,
    );

    return (
        <Card className={cn('rounded-lg pt-0 shadow-sm', className)}>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                <div className="grid flex-1 gap-1">
                    <CardTitle>Tren percakapan</CardTitle>
                    <CardDescription>
                        Jumlah percakapan masuk dalam periode terpilih.
                    </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger
                        className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
                        aria-label="Pilih periode"
                    >
                        <SelectValue placeholder="90 hari terakhir" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="90d" className="rounded-lg">
                            3 bulan terakhir
                        </SelectItem>
                        <SelectItem value="30d" className="rounded-lg">
                            30 hari terakhir
                        </SelectItem>
                        <SelectItem value="7d" className="rounded-lg">
                            7 hari terakhir
                        </SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="min-h-0 px-2 pt-14 sm:px-6 sm:pt-16">
                {hasConversationData ? (
                    <ChartContainer
                        config={chartConfig}
                        className={cn(
                            'aspect-auto h-[250px] w-full',
                            chartClassName,
                        )}
                    >
                        <AreaChart
                            data={chartData}
                            margin={{ top: 18, right: 8, bottom: 12, left: 8 }}
                        >
                            <defs>
                                <linearGradient
                                    id="fillConversations"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-conversations)"
                                        stopOpacity={0.55}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-conversations)"
                                        stopOpacity={0.08}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={32}
                                tickFormatter={(value) => {
                                    return formatConversationDate(
                                        String(value),
                                        timeRange,
                                    );
                                }}
                            />
                            <YAxis
                                hide
                                domain={[0, 'dataMax + 1']}
                                allowDataOverflow={false}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(value) => {
                                            return new Date(
                                                String(value),
                                            ).toLocaleDateString('id-ID', {
                                                month: 'short',
                                                ...(timeRange === '90d'
                                                    ? {}
                                                    : { day: 'numeric' }),
                                                year: 'numeric',
                                            });
                                        }}
                                        indicator="dot"
                                    />
                                }
                            />
                            <Area
                                dataKey="conversations"
                                type="monotone"
                                fill="url(#fillConversations)"
                                stroke="var(--color-conversations)"
                                strokeWidth={2.5}
                                dot={{ r: 3, strokeWidth: 0 }}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ChartContainer>
                ) : (
                    <div
                        className={cn(
                            chartClassName,
                            'flex min-h-[250px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center',
                        )}
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-slate-900">
                            Belum ada percakapan pada periode ini
                        </p>
                        <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                            Grafik akan muncul setelah percakapan baru tercatat
                            dalam rentang waktu yang dipilih.
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="mt-auto shrink-0 border-t px-6 py-4">
                <div className="grid w-full gap-1 text-sm">
                    <p className="font-semibold text-slate-900">
                        {hasConversationData
                            ? `${totalConversations.toLocaleString('id-ID')} percakapan dalam periode ini`
                            : 'Belum ada percakapan tercatat'}
                    </p>
                    <p className="text-slate-500">
                        {hasConversationData && peakItem
                            ? `Puncak aktivitas: ${formatConversationDate(peakItem.date, timeRange)} dengan ${peakItem.conversations.toLocaleString('id-ID')} percakapan.`
                            : 'Pilih periode lain atau tunggu data percakapan baru masuk.'}
                    </p>
                </div>
            </CardFooter>
        </Card>
    );
}
