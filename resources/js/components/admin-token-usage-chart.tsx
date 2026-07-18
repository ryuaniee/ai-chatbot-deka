import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
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

type TokenUsageChartItem = {
    user: string;
    promptTokens: number;
    completionTokens: number;
};

const chartConfig = {
    promptTokens: {
        label: 'Prompt',
        color: 'var(--chart-1)',
    },
    completionTokens: {
        label: 'Completion',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

export function AdminTokenUsageChart({
    data,
}: {
    data: TokenUsageChartItem[];
}) {
    return (
        <Card className="h-full rounded-lg pt-0">
            <CardHeader className="border-b py-5">
                <CardTitle>Grafik token per user</CardTitle>
                <CardDescription>
                    Perbandingan prompt dan completion token tiap user.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[310px] w-full"
                >
                    <BarChart data={data}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="user"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            interval={0}
                            tickFormatter={(value) =>
                                String(value).split(' ')[0]
                            }
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Bar
                            dataKey="promptTokens"
                            fill="var(--color-promptTokens)"
                            radius={[4, 4, 0, 0]}
                        />
                        <Bar
                            dataKey="completionTokens"
                            fill="var(--color-completionTokens)"
                            radius={[4, 4, 0, 0]}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
