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

const chartData = [
    { month: 'Januari', dislikes: 12, likes: 80 },
    { month: 'Februari', dislikes: 18, likes: 200 },
    { month: 'Maret', dislikes: 15, likes: 120 },
    { month: 'April', dislikes: 11, likes: 150 },
    { month: 'Mei', dislikes: 9, likes: 130 },
    { month: 'Juni', dislikes: 7, likes: 140 },
];

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
}: {
    chartClassName?: string;
    className?: string;
}) {
    return (
        <Card className={cn('flex h-full flex-col rounded-lg pt-0', className)}>
            <CardHeader className="border-b py-5">
                <CardTitle>Diagram Batang Feedback</CardTitle>
                <CardDescription>
                    Perbandingan like dan dislike Januari - Juni 2026.
                </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className={cn(
                        'aspect-auto h-[310px] w-full',
                        chartClassName,
                    )}
                >
                    <BarChart accessibilityLayer data={chartData}>
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
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 leading-none font-medium">
                    Feedback positif naik 5.2% bulan ini
                    <TrendingUp className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Menampilkan perbandingan like dan dislike selama 6 bulan.
                </div>
            </CardFooter>
        </Card>
    );
}
