import { TrendingUp } from 'lucide-react';
import { Pie, PieChart } from 'recharts';
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
import { cn } from '@/lib/utils';

type TokenUsageChartItem = {
    user: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
};

const formatNumber = (value: number) =>
    new Intl.NumberFormat('id-ID').format(value);

const chartConfig = {
    tokens: {
        label: 'Token',
    },
} satisfies ChartConfig;

const tokenSegmentColors = [
    '#2f80ed',
    '#22c55e',
    '#f59e0b',
    '#8b5cf6',
    '#ef4444',
    '#14b8a6',
    '#f97316',
    '#64748b',
];

export function AdminTokenUsageChart({
    chartClassName,
    className,
    data,
}: {
    chartClassName?: string;
    className?: string;
    data: TokenUsageChartItem[];
}) {
    const totalTokens = data.reduce(
        (total, item) => total + item.totalTokens,
        0,
    );
    const promptTokens = data.reduce(
        (total, item) => total + item.promptTokens,
        0,
    );
    const completionTokens = data.reduce(
        (total, item) => total + item.completionTokens,
        0,
    );
    const chartData = data.map((item, index) => ({
        fill: tokenSegmentColors[index % tokenSegmentColors.length],
        tokens: item.totalTokens,
        user: item.user,
    }));
    const topUsers = chartData.slice(0, 5);

    return (
        <Card className={cn('flex h-full flex-col rounded-lg', className)}>
            <CardHeader className="items-center pb-3 text-center">
                <CardTitle>Distribusi Token</CardTitle>
                <CardDescription>
                    Porsi pemakaian token antar pengguna aktif.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pb-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                            Total
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                            {formatNumber(totalTokens)}
                        </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                            Input
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                            {formatNumber(promptTokens)}
                        </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                            Output
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                            {formatNumber(completionTokens)}
                        </p>
                    </div>
                </div>
                <ChartContainer
                    config={chartConfig}
                    className={cn(
                        'mx-auto aspect-square max-h-[360px]',
                        chartClassName,
                    )}
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie data={chartData} dataKey="tokens" nameKey="user" />
                    </PieChart>
                </ChartContainer>
                <div className="grid gap-2">
                    {topUsers.map((item) => {
                        const percent =
                            totalTokens > 0
                                ? Math.round((item.tokens / totalTokens) * 100)
                                : 0;

                        return (
                            <div
                                key={item.user}
                                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {item.user}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {percent}% dari total
                                    </p>
                                </div>
                                <p className="text-right text-sm font-semibold tabular-nums">
                                    {formatNumber(item.tokens)}
                                </p>
                                <span className="h-2 w-10 overflow-hidden rounded-full bg-muted">
                                    <span
                                        className="block h-full rounded-full"
                                        style={{
                                            backgroundColor: item.fill,
                                            width: `${percent}%`,
                                        }}
                                    />
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 leading-none font-medium">
                    Pemakaian token naik 5.2% bulan ini
                    <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                    Berdasarkan pengguna aktif
                </div>
            </CardFooter>
        </Card>
    );
}
