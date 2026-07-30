import { ChartPie, TrendingDown, TrendingUp } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
    const hasTokenData = totalTokens > 0;
    const promptTokenShare = Math.round(
        (promptTokens / Math.max(totalTokens, 1)) * 100,
    );
    const completionTokenShare = Math.round(
        (completionTokens / Math.max(totalTokens, 1)) * 100,
    );
    const trendLabel = getTrendLabel(trend);
    const TrendIcon =
        trend?.direction === 'up'
            ? TrendingUp
            : trend?.direction === 'down'
              ? TrendingDown
              : null;

    return (
        <Card
            className={cn(
                'flex h-full min-h-[560px] flex-col rounded-lg shadow-sm',
                className,
            )}
        >
            <CardHeader className="shrink-0 items-center pb-3 text-center">
                <CardTitle>Komposisi Token</CardTitle>
                <CardDescription>
                    Perbandingan token input dan output AI.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pb-4">
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
                    <div className="grid min-h-0 flex-1 items-center gap-4">
                        <div
                            className={cn(
                                'mx-auto flex h-[180px] max-h-[180px] w-full max-w-[240px] flex-none items-center justify-center',
                                chartClassName,
                            )}
                        >
                            <div
                                className="relative h-[160px] w-[160px] rounded-full shadow-sm"
                                style={{
                                    background: `conic-gradient(#2f80ed 0deg ${promptTokenShare * 3.6}deg, #22c55e ${promptTokenShare * 3.6}deg 360deg)`,
                                }}
                                aria-label={`Input ${promptTokenShare} persen, output ${completionTokenShare} persen`}
                                role="img"
                            >
                                <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                                    <span className="text-[11px] font-medium text-slate-500">
                                        Input
                                    </span>
                                    <span className="text-2xl font-bold text-slate-950 tabular-nums">
                                        {promptTokenShare}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-2 text-sm">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-blue-50 px-3 py-2 text-blue-950 ring-1 ring-blue-100">
                                <span className="flex items-center gap-2 font-medium">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#2f80ed]" />
                                    Input
                                </span>
                                <span className="font-semibold tabular-nums">
                                    {promptTokenShare}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-emerald-950 ring-1 ring-emerald-100">
                                <span className="flex items-center gap-2 font-medium">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                                    Output
                                </span>
                                <span className="font-semibold tabular-nums">
                                    {completionTokenShare}%
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600 ring-1 ring-blue-100">
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
            <CardFooter className="shrink-0 flex-col gap-2 border-t px-4 py-4 text-center text-sm">
                <div className="flex flex-wrap items-center justify-center gap-2 leading-5 font-medium">
                    {hasTokenData
                        ? trendLabel
                        : 'Menunggu data pemakaian token'}
                    {hasTokenData && TrendIcon && (
                        <TrendIcon className="h-4 w-4" />
                    )}
                </div>
                <div className="flex items-center gap-2 leading-5 text-muted-foreground">
                    {hasTokenData
                        ? 'Berdasarkan pengguna aktif'
                        : 'Berdasarkan percakapan yang sudah tersimpan'}
                </div>
            </CardFooter>
        </Card>
    );
}
