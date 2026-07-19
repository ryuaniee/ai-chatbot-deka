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

const chartConfig = {
    tokens: {
        label: 'Token',
    },
    nadia: {
        label: 'Nadia',
        color: 'var(--primary)',
    },
    raka: {
        label: 'Raka',
        color: 'color-mix(in oklab, var(--primary) 78%, white)',
    },
    ayu: {
        label: 'Ayu',
        color: 'color-mix(in oklab, var(--primary) 58%, white)',
    },
    admin: {
        label: 'Admin',
        color: 'color-mix(in oklab, var(--primary) 38%, white)',
    },
    other: {
        label: 'Lainnya',
        color: 'color-mix(in oklab, var(--primary) 20%, white)',
    },
} satisfies ChartConfig;

const userKey = (name: string) => {
    const firstName = name.split(' ')[0].toLowerCase();

    return ['nadia', 'raka', 'ayu', 'admin'].includes(firstName)
        ? firstName
        : 'other';
};

export function AdminTokenUsageChart({
    chartClassName,
    className,
    data,
}: {
    chartClassName?: string;
    className?: string;
    data: TokenUsageChartItem[];
}) {
    const chartData = data.map((item) => ({
        fill: `var(--color-${userKey(item.user)})`,
        tokens: item.totalTokens,
        user: userKey(item.user),
    }));

    return (
        <Card className={cn('flex h-full flex-col rounded-lg', className)}>
            <CardHeader className="items-center pb-4">
                <CardTitle>Pie Token Usage</CardTitle>
                <CardDescription>
                    Distribusi total token berdasarkan pengguna aktif.
                </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 pb-0">
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
