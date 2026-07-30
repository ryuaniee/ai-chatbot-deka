import { TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
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

type FeedbackChartItem = {
    month: string;
    dislikes: number;
    likes: number;
};

const chartConfig = {
    likes: {
        label: 'Like',
        color: 'var(--primary)',
    },
    dislikes: {
        label: 'Dislike',
        color: 'color-mix(in oklab, var(--primary) 52%, white)',
    },
} satisfies ChartConfig;

export function AdminFeedbackBarChart({
    chartClassName,
    className,
    data,
}: {
    chartClassName?: string;
    className?: string;
    data: FeedbackChartItem[];
}) {
    const hasFeedbackData = data.some(
        (item) => item.likes > 0 || item.dislikes > 0,
    );

    return (
        <Card
            className={cn(
                'flex h-full flex-col rounded-lg pt-0 shadow-sm',
                className,
            )}
        >
            <CardHeader className="border-b py-5">
                <CardTitle>Diagram Batang Feedback</CardTitle>
                <CardDescription>
                    Perbandingan like dan dislike Januari - Juni 2026.
                </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden px-2 pt-14 sm:px-6 sm:pt-16">
                <ChartContainer
                    config={chartConfig}
                    className={cn(
                        'aspect-auto h-[280px] w-full',
                        chartClassName,
                    )}
                >
                    <BarChart
                        accessibilityLayer
                        data={data}
                        margin={{ top: 18, right: 8, bottom: 12, left: 8 }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tickFormatter={(value) => String(value).slice(0, 3)}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dashed" />}
                        />
                        <Bar
                            dataKey="likes"
                            fill="var(--color-likes)"
                            radius={4}
                        />
                        <Bar
                            dataKey="dislikes"
                            fill="var(--color-dislikes)"
                            radius={4}
                        />
                    </BarChart>
                </ChartContainer>
                {!hasFeedbackData && (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Feedback chart akan lebih informatif setelah user mulai
                        memberi like atau dislike.
                    </div>
                )}
            </CardContent>
            <CardFooter className="shrink-0 flex-col items-start gap-2 border-t px-6 py-4 text-sm">
                <div className="flex gap-2 leading-5 font-medium">
                    {hasFeedbackData
                        ? 'Feedback positif naik 5.2% bulan ini'
                        : 'Menunggu pola feedback user'}
                    {hasFeedbackData && <TrendingUp className="h-4 w-4" />}
                </div>
                <div className="leading-5 text-muted-foreground">
                    Menampilkan perbandingan like dan dislike selama 6 bulan.
                </div>
            </CardFooter>
        </Card>
    );
}
