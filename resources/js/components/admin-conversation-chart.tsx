import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
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
    resolved: {
        label: 'Selesai',
        color: 'color-mix(in oklab, var(--primary) 52%, white)',
    },
} satisfies ChartConfig;

type ConversationChartItem = {
    date: string;
    conversations: number;
    resolved: number;
};

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

    return (
        <Card className={cn('rounded-lg pt-0', className)}>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                <div className="grid flex-1 gap-1">
                    <CardTitle>Tren percakapan</CardTitle>
                    <CardDescription>
                        Perbandingan chat masuk dan chat selesai dalam periode
                        terpilih.
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
            <CardContent className="min-h-0 flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className={cn(
                        'aspect-auto h-[250px] w-full',
                        chartClassName,
                    )}
                >
                    <AreaChart data={filteredData}>
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
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-conversations)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                            <linearGradient
                                id="fillResolved"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-resolved)"
                                    stopOpacity={0.7}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-resolved)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(String(value));

                                return date.toLocaleDateString('id-ID', {
                                    month: 'short',
                                    day: 'numeric',
                                });
                            }}
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
                                            day: 'numeric',
                                            year: 'numeric',
                                        });
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="resolved"
                            type="natural"
                            fill="url(#fillResolved)"
                            stroke="var(--color-resolved)"
                            stackId="a"
                        />
                        <Area
                            dataKey="conversations"
                            type="natural"
                            fill="url(#fillConversations)"
                            stroke="var(--color-conversations)"
                            stackId="a"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
