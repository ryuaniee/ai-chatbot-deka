import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import { cn } from '@/lib/utils';

export type TokenTrendItem = {
    date: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requests: number;
};

const chartConfig = {
    promptTokens: {
        label: 'Input',
        color: 'var(--primary)',
    },
    completionTokens: {
        label: 'Output',
        color: 'color-mix(in oklab, var(--primary) 48%, white)',
    },
} satisfies ChartConfig;

const formatNumber = (value: number) =>
    new Intl.NumberFormat('id-ID').format(value);

export function AdminTokenTrendChart({
    chartClassName,
    className,
    data,
}: {
    chartClassName?: string;
    className?: string;
    data: TokenTrendItem[];
}) {
    const hasTokenData = data.some((item) => item.totalTokens > 0);

    return (
        <Card className={cn('flex h-full flex-col rounded-lg pt-0', className)}>
            <CardHeader className="border-b py-5">
                <div className="grid gap-1">
                    <CardTitle>Tren Pemakaian Token</CardTitle>
                    <CardDescription>
                        Pergerakan input dan output token selama 30 hari
                        terakhir.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
                {hasTokenData ? (
                    <ChartContainer
                        config={chartConfig}
                        className={cn(
                            'aspect-auto h-[330px] w-full',
                            chartClassName,
                        )}
                    >
                        <AreaChart
                            accessibilityLayer
                            data={data}
                            margin={{
                                top: 12,
                                right: 12,
                                bottom: 12,
                                left: 12,
                            }}
                        >
                            <defs>
                                <linearGradient
                                    id="fillPromptTokens"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-promptTokens)"
                                        stopOpacity={0.8}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-promptTokens)"
                                        stopOpacity={0.1}
                                    />
                                </linearGradient>
                                <linearGradient
                                    id="fillCompletionTokens"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-completionTokens)"
                                        stopOpacity={0.7}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-completionTokens)"
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
                                minTickGap={24}
                                tickFormatter={(value) =>
                                    new Date(String(value)).toLocaleDateString(
                                        'id-ID',
                                        {
                                            day: 'numeric',
                                            month: 'short',
                                        },
                                    )
                                }
                            />
                            <YAxis
                                hide
                                domain={[0, 'dataMax + 100']}
                                allowDataOverflow={false}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        labelFormatter={(value, payload) => {
                                            const item = payload[0]?.payload as
                                                TokenTrendItem | undefined;

                                            return (
                                                <div className="grid gap-1">
                                                    <span>
                                                        {new Date(
                                                            String(value),
                                                        ).toLocaleDateString(
                                                            'id-ID',
                                                            {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric',
                                                            },
                                                        )}
                                                    </span>
                                                    {item && (
                                                        <span className="font-normal text-muted-foreground">
                                                            {formatNumber(
                                                                item.totalTokens,
                                                            )}{' '}
                                                            token dari{' '}
                                                            {formatNumber(
                                                                item.requests,
                                                            )}{' '}
                                                            request
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }}
                                    />
                                }
                            />
                            <Area
                                dataKey="completionTokens"
                                type="monotone"
                                fill="url(#fillCompletionTokens)"
                                stroke="var(--color-completionTokens)"
                                stackId="a"
                            />
                            <Area
                                dataKey="promptTokens"
                                type="monotone"
                                fill="url(#fillPromptTokens)"
                                stroke="var(--color-promptTokens)"
                                stackId="a"
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ChartContainer>
                ) : (
                    <div className="flex min-h-[300px] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center">
                        <div>
                            <p className="text-sm font-semibold">
                                Belum ada data token
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                Tren akan muncul setelah respons AI mencatat
                                pemakaian token.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
