import { ChartPie, TrendingDown, TrendingUp } from 'lucide-react';
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

type TokenUsageTrend = {
    currentTokens: number;
    previousTokens: number;
    changePercent: number | null;
    direction: 'up' | 'down' | 'flat' | 'neutral';
};

const formatNumber = (value: number) =>
    new Intl.NumberFormat('id-ID').format(value);

const formatPercent = (value: number) =>
    new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 1,
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    }).format(Math.abs(value));

const getTrendLabel = (trend?: TokenUsageTrend) => {
    if (!trend || trend.changePercent === null) {
        return 'Belum ada pembanding bulan lalu';
    }

    if (trend.direction === 'flat' || trend.changePercent === 0) {
        return 'Pemakaian token stabil bulan ini';
    }

    const directionLabel = trend.direction === 'down' ? 'turun' : 'naik';

    return `Pemakaian token ${directionLabel} ${formatPercent(
        trend.changePercent,
    )}% bulan ini`;
};

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
    trend,
}: {
    chartClassName?: string;
    className?: string;
    data: TokenUsageChartItem[];
    trend?: TokenUsageTrend;
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
        name: 'Pemakaian token',
        tokens: item.totalTokens,
    }));
    const hasTokenData = totalTokens > 0;
    const trendLabel = getTrendLabel(trend);
    const TrendIcon =
        trend?.direction === 'up'
            ? TrendingUp
            : trend?.direction === 'down'
              ? TrendingDown
              : null;

    return (
        <Card className={cn('flex h-full flex-col rounded-lg', className)}>
            <CardHeader className="shrink-0 items-center pb-3 text-center">
                <CardTitle>Distribusi Token</CardTitle>
                <CardDescription>
                    Porsi pemakaian token antar pengguna aktif.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-3">
                <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
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
                {hasTokenData ? (
                    <>
                        <ChartContainer
                            config={chartConfig}
                            className={cn(
                                'mx-auto aspect-square max-h-[320px] min-h-0 w-full flex-1',
                                chartClassName,
                            )}
                        >
                            <PieChart>
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Pie
                                    data={chartData}
                                    dataKey="tokens"
                                    nameKey="name"
                                />
                            </PieChart>
                        </ChartContainer>
                    </>
                ) : (
                    <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600 ring-1 ring-blue-100   ">
                            <ChartPie className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-sm font-semibold">
                            Belum ada penggunaan token
                        </p>
                        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                            Data distribusi akan muncul setelah pengguna mulai
                            chat dan respons AI mencatat pemakaian token.
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="shrink-0 flex-col gap-2 border-t px-4 pt-3 pb-4 text-center text-sm">
                <div className="flex flex-wrap items-center justify-center gap-2 leading-tight font-medium">
                    {hasTokenData
                        ? trendLabel
                        : 'Menunggu data pemakaian token'}
                    {hasTokenData && TrendIcon && (
                        <TrendIcon className="h-4 w-4" />
                    )}
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                    {hasTokenData
                        ? 'Berdasarkan pengguna aktif'
                        : 'Berdasarkan percakapan yang sudah tersimpan'}
                </div>
            </CardFooter>
        </Card>
    );
}
