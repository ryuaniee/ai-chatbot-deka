import { Head, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    Bot,
    CheckCircle2,
    ChevronDown,
    Clock3,
    FileText,
    LayoutDashboard,
    MessageSquare,
    Search,
    ShieldCheck,
    Sparkles,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { AdminConversationChart } from '@/components/admin-conversation-chart';
import { AdminTokenUsageChart } from '@/components/admin-token-usage-chart';
import DekaLogo from '@/components/deka-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import type { Auth } from '@/types';

type Metric = {
    label: string;
    value: string;
    description: string;
    tone: 'green' | 'blue' | 'amber' | 'neutral';
    icon: keyof typeof metricIcons;
};

type Conversation = {
    user: string;
    topic: string;
    status: string;
    time: string;
};

type KnowledgeItem = {
    title: string;
    source: string;
    chunks: number;
    status: string;
};

type TokenUsageItem = {
    user: string;
    email: string;
    role: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
};

type ChatTrendItem = {
    date: string;
    conversations: number;
    resolved: number;
};

type SectionId =
    | 'overview'
    | 'token-usage'
    | 'chat-trend'
    | 'chat-api'
    | 'knowledge'
    | 'runtime'
    | 'moderation'
    | 'auth';

const metricIcons = {
    message: MessageSquare,
    sparkles: Sparkles,
    users: Users,
    book: BookOpen,
} satisfies Record<string, LucideIcon>;

const tokenUsageItems: TokenUsageItem[] = [
    {
        user: 'Nadia Putri',
        email: 'nadia@example.com',
        role: 'user',
        requests: 42,
        promptTokens: 18420,
        completionTokens: 26380,
        totalTokens: 44800,
    },
    {
        user: 'Raka Firmansyah',
        email: 'raka@example.com',
        role: 'user',
        requests: 36,
        promptTokens: 15360,
        completionTokens: 21490,
        totalTokens: 36850,
    },
    {
        user: 'Ayu Lestari',
        email: 'ayu@example.com',
        role: 'user',
        requests: 28,
        promptTokens: 12610,
        completionTokens: 17230,
        totalTokens: 29840,
    },
    {
        user: 'Admin Deka',
        email: 'admin@deka.dev',
        role: 'admin',
        requests: 11,
        promptTokens: 4910,
        completionTokens: 6320,
        totalTokens: 11230,
    },
];

const conversations: Conversation[] = [
    {
        user: 'Nadia Putri',
        topic: 'Menanyakan layanan Deka Studio',
        status: 'Selesai',
        time: '2 menit lalu',
    },
    {
        user: 'Raka Firmansyah',
        topic: 'Info lokasi dan jam operasional',
        status: 'Berjalan',
        time: '8 menit lalu',
    },
    {
        user: 'Ayu Lestari',
        topic: 'Pertanyaan di luar data bot',
        status: 'Butuh cek',
        time: '21 menit lalu',
    },
    {
        user: 'Bagus Pratama',
        topic: 'Kontak customer service Deka',
        status: 'Selesai',
        time: '35 menit lalu',
    },
];

const knowledgeItems: KnowledgeItem[] = [
    {
        title: 'Deka Knowledge Base Draft Rekap',
        source: 'PDF internal',
        chunks: 312,
        status: 'active',
    },
    {
        title: 'deka.dev crawl',
        source: 'Website',
        chunks: 418,
        status: 'active',
    },
    {
        title: 'Catatan layanan terbaru',
        source: 'Teks manual',
        chunks: 112,
        status: 'review',
    },
];

const chatTrendItems: ChatTrendItem[] = Array.from(
    { length: 90 },
    (_, index) => {
        const date = new Date(Date.UTC(2026, 3, 20));
        date.setUTCDate(date.getUTCDate() + index);

        const weeklyPattern = [46, 32, 58, 49, 72, 66, 39][index % 7];
        const monthlyLift = Math.floor(index / 12) * 5;
        const campaignSpike = index % 19 === 0 ? 38 : 0;
        const conversations = 118 + weeklyPattern + monthlyLift + campaignSpike;
        const resolved = Math.round(
            conversations * (0.74 + (index % 5) * 0.03),
        );

        return {
            date: date.toISOString().slice(0, 10),
            conversations,
            resolved,
        };
    },
);

const totalTokenUsage = tokenUsageItems.reduce(
    (total, item) => total + item.totalTokens,
    0,
);
const totalTokenRequests = tokenUsageItems.reduce(
    (total, item) => total + item.requests,
    0,
);

const metrics: Metric[] = [
    {
        label: 'Percakapan aktif',
        value: '128',
        description: 'Sesi chat yang masuk hari ini',
        tone: 'blue',
        icon: 'message',
    },
    {
        label: 'Total token',
        value: formatNumber(totalTokenUsage),
        description: 'Pemakaian AI dari semua user',
        tone: 'green',
        icon: 'sparkles',
    },
    {
        label: 'User aktif',
        value: formatNumber(tokenUsageItems.length),
        description: `${formatNumber(totalTokenRequests)} request tercatat`,
        tone: 'neutral',
        icon: 'users',
    },
    {
        label: 'Sumber data bot',
        value: formatNumber(knowledgeItems.length),
        description: 'Dokumen yang dipakai untuk jawaban',
        tone: 'amber',
        icon: 'book',
    },
];

const navigation: {
    id: SectionId;
    label: string;
    description: string;
    icon: LucideIcon;
}[] = [
    {
        id: 'overview',
        label: 'Dashboard',
        description: 'Ringkasan chat, user, token, dan knowledge',
        icon: LayoutDashboard,
    },
    {
        id: 'token-usage',
        label: 'Token per User',
        description: 'Pemakaian token tiap user',
        icon: Users,
    },
    {
        id: 'chat-trend',
        label: 'Tren Chat',
        description: 'Grafik percakapan dan sesi selesai',
        icon: BarChart3,
    },
    {
        id: 'chat-api',
        label: 'Chat API',
        description: 'Endpoint chat dan streaming',
        icon: MessageSquare,
    },
    {
        id: 'knowledge',
        label: 'Data Bot',
        description: 'Sumber jawaban chatbot Deka',
        icon: BookOpen,
    },
    {
        id: 'runtime',
        label: 'Pengaturan AI',
        description: 'Model dan cara bot menjawab',
        icon: Bot,
    },
    {
        id: 'moderation',
        label: 'Keamanan Chat',
        description: 'Filter pesan dan batas request',
        icon: ShieldCheck,
    },
    {
        id: 'auth',
        label: 'Pengguna',
        description: 'Admin, user, login, dan role',
        icon: Users,
    },
];

const toneClasses: Record<Metric['tone'], string> = {
    green: 'bg-[#e8f2ff] text-[#155fc4] ring-[#b9d8ff] dark:bg-[#12365f] dark:text-[#b8d9ff] dark:ring-[#245a96]',
    blue: 'bg-[#eaf3ff] text-[#2f80ed] ring-[#b9d8ff] dark:bg-[#102b4a] dark:text-[#8fc1ff] dark:ring-[#245a96]',
    amber: 'bg-[#fff4df] text-[#b45309] ring-[#f5d08b] dark:bg-[#3b2508] dark:text-[#f7c56b] dark:ring-[#7c4a08]',
    neutral:
        'bg-[#eef4fb] text-[#40566f] ring-[#d9e4f2] dark:bg-[#10233a] dark:text-[#b7c7d9] dark:ring-[#1d3652]',
};

const statusClasses: Record<string, string> = {
    active: 'border-transparent bg-[#e8f2ff] text-[#155fc4] dark:bg-[#12365f] dark:text-[#b8d9ff]',
    Selesai:
        'border-transparent bg-[#e8f2ff] text-[#155fc4] dark:bg-[#12365f] dark:text-[#b8d9ff]',
    Berjalan:
        'border-transparent bg-[#eaf8ff] text-[#0369a1] dark:bg-[#082f49] dark:text-[#7dd3fc]',
    'Butuh cek':
        'border-transparent bg-[#fff4df] text-[#b45309] dark:bg-[#3b2508] dark:text-[#f7c56b]',
};

export default function AdminPage() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [activeSection, setActiveSection] = useState<SectionId>('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const profileInitials = auth.user.name
        .split(' ')
        .map((name) => name[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const handleNavigate = (sectionId: SectionId) => {
        setActiveSection(sectionId);
        document
            .getElementById(sectionId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const activeNavigation = navigation.find(
        (item) => item.id === activeSection,
    );

    return (
        <>
            <Head title="Admin Dashboard" />

            <div className="min-h-screen bg-background text-foreground">
                <aside
                    className={`fixed inset-y-0 left-0 z-30 hidden border-r bg-card transition-[width] duration-200 lg:flex lg:flex-col ${
                        sidebarCollapsed ? 'w-20' : 'w-64'
                    }`}
                >
                    <div
                        className={`flex h-16 items-center border-b px-4 ${
                            sidebarCollapsed ? 'justify-center' : 'gap-3'
                        }`}
                    >
                        <button
                            type="button"
                            title={
                                sidebarCollapsed
                                    ? 'Buka sidebar'
                                    : 'Tutup sidebar'
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent"
                            onClick={() =>
                                setSidebarCollapsed((value) => !value)
                            }
                        >
                            <DekaLogo className="h-6 w-auto" />
                        </button>
                        <div
                            className={`min-w-0 ${sidebarCollapsed ? 'hidden' : ''}`}
                        >
                            <p className="truncate text-sm font-semibold">
                                Deka Admin
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                Chatbot operations
                            </p>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-1.5 px-3 py-4">
                        {navigation.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                title={
                                    sidebarCollapsed ? item.label : undefined
                                }
                                onClick={() => handleNavigate(item.id)}
                                className={`flex h-11 w-full items-center rounded-md text-sm font-medium transition-colors ${
                                    activeSection === item.id
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                } ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
                            >
                                <item.icon className="h-4 w-4" />
                                <span
                                    className={`truncate ${sidebarCollapsed ? 'hidden' : ''}`}
                                >
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </nav>

                    <div className="border-t p-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {sidebarCollapsed ? (
                                    <button
                                        type="button"
                                        title={auth.user.name}
                                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 transition-colors hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:outline-none dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-900 dark:hover:bg-blue-900"
                                    >
                                        {profileInitials}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-md border bg-muted/40 p-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <UserInfo user={auth.user} showEmail />
                                        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                                    </button>
                                )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align={sidebarCollapsed ? 'center' : 'start'}
                                side="top"
                                className="w-64 rounded-lg p-1.5"
                            >
                                <UserMenuContent
                                    user={auth.user}
                                    onSettingsClick={() =>
                                        handleNavigate('auth')
                                    }
                                />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </aside>

                <div
                    className={`transition-[padding] duration-200 ${
                        sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
                    }`}
                >
                    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
                        <div className="flex items-center gap-3">
                            <DekaLogo className="h-8 w-auto lg:hidden" />
                            <Separator
                                orientation="vertical"
                                className="hidden h-6 lg:block"
                            />
                            <div>
                                <h1 className="text-base font-semibold md:text-lg">
                                    {activeNavigation?.label ?? 'Dashboard'}
                                </h1>
                                <p className="hidden text-sm text-muted-foreground sm:block">
                                    {activeNavigation?.description ??
                                        'Ringkasan operasional chatbot Deka.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative hidden w-72 md:block">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    className="h-9 pl-9"
                                    placeholder="Cari percakapan"
                                />
                            </div>
                        </div>
                    </header>

                    <main className="flex w-full flex-col gap-6 px-4 py-6 md:px-6">
                        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                            {navigation.map((item) => (
                                <Button
                                    key={item.id}
                                    type="button"
                                    size="sm"
                                    variant={
                                        activeSection === item.id
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="shrink-0"
                                    onClick={() => handleNavigate(item.id)}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Button>
                            ))}
                        </div>

                        <section
                            id="overview"
                            className="grid scroll-mt-24 gap-4 md:grid-cols-2 2xl:grid-cols-4"
                        >
                            {metrics.map((metric) => (
                                <MetricCard
                                    key={metric.label}
                                    metric={metric}
                                />
                            ))}
                        </section>

                        <section
                            id="token-usage"
                            className="grid scroll-mt-24 gap-6 xl:grid-cols-2"
                        >
                            <Card className="rounded-lg">
                                <CardHeader className="gap-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <CardTitle>
                                                Usage token per user
                                            </CardTitle>
                                            <CardDescription>
                                                Ringkasan token AI yang dipakai
                                                tiap pengguna.
                                            </CardDescription>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className="w-fit"
                                        >
                                            {formatNumber(totalTokenUsage)}{' '}
                                            total token
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-md border">
                                        <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[220px_100px_120px_120px_120px]">
                                            <span>User</span>
                                            <span className="hidden md:block">
                                                Request
                                            </span>
                                            <span className="hidden md:block">
                                                Prompt
                                            </span>
                                            <span className="hidden md:block">
                                                Completion
                                            </span>
                                            <span>Total</span>
                                        </div>
                                        {tokenUsageItems.length > 0 ? (
                                            tokenUsageItems.map((item) => (
                                                <div
                                                    key={item.email}
                                                    className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[220px_100px_120px_120px_120px]"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="truncate text-sm font-medium">
                                                                {item.user}
                                                            </p>
                                                            <Badge
                                                                variant="outline"
                                                                className="hidden text-[10px] capitalize sm:inline-flex"
                                                            >
                                                                {item.role}
                                                            </Badge>
                                                        </div>
                                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                                            {item.email}
                                                        </p>
                                                    </div>
                                                    <TokenCell
                                                        value={formatNumber(
                                                            item.requests,
                                                        )}
                                                    />
                                                    <TokenCell
                                                        value={formatNumber(
                                                            item.promptTokens,
                                                        )}
                                                    />
                                                    <TokenCell
                                                        value={formatNumber(
                                                            item.completionTokens,
                                                        )}
                                                    />
                                                    <div className="text-right md:text-left">
                                                        <p className="text-sm font-semibold">
                                                            {formatNumber(
                                                                item.totalTokens,
                                                            )}
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {formatNumber(
                                                                Math.round(
                                                                    item.totalTokens /
                                                                        item.requests,
                                                                ),
                                                            )}
                                                            /req
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <EmptyTableRow text="Belum ada pemakaian token dari chat AI." />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <AdminTokenUsageChart data={tokenUsageItems} />
                        </section>

                        <section id="chat-trend" className="scroll-mt-24">
                            <AdminConversationChart data={chatTrendItems} />
                        </section>

                        <section
                            id="chat-api"
                            className="grid scroll-mt-24 gap-6 xl:grid-cols-2"
                        >
                            <Card className="rounded-lg">
                                <CardHeader className="gap-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <CardTitle>Chat API</CardTitle>
                                            <CardDescription>
                                                Endpoint conversation dan
                                                message sesuai kontrak frontend.
                                            </CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm">
                                            <BarChart3 className="h-4 w-4" />
                                            Laporan
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-md border">
                                        <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[180px_1fr_120px_120px]">
                                            <span>User</span>
                                            <span className="hidden md:block">
                                                Topik
                                            </span>
                                            <span className="hidden md:block">
                                                Status
                                            </span>
                                            <span>Waktu</span>
                                        </div>
                                        {conversations.length > 0 ? (
                                            conversations.map(
                                                (conversation) => (
                                                    <div
                                                        key={`${conversation.user}-${conversation.time}`}
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[180px_1fr_120px_120px]"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">
                                                                {
                                                                    conversation.user
                                                                }
                                                            </p>
                                                            <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">
                                                                {
                                                                    conversation.topic
                                                                }
                                                            </p>
                                                        </div>
                                                        <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
                                                            {conversation.topic}
                                                        </p>
                                                        <div className="hidden md:block">
                                                            <Badge
                                                                variant="outline"
                                                                className={statusClass(
                                                                    conversation.status,
                                                                )}
                                                            >
                                                                {conversationStatusLabel(
                                                                    conversation.status,
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm whitespace-nowrap text-muted-foreground">
                                                            {conversation.time}
                                                        </p>
                                                    </div>
                                                ),
                                            )
                                        ) : (
                                            <EmptyTableRow text="Belum ada percakapan yang tersimpan." />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-6">
                                <Card className="rounded-lg">
                                    <CardHeader>
                                        <CardTitle>Kontrak endpoint</CardTitle>
                                        <CardDescription>
                                            Dipakai halaman chat dengan session
                                            cookie Laravel.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <EndpointRow
                                            method="GET"
                                            path="/api/conversations"
                                        />
                                        <EndpointRow
                                            method="POST"
                                            path="/api/conversations"
                                        />
                                        <EndpointRow
                                            method="POST"
                                            path="/api/conversations/stream"
                                        />
                                        <EndpointRow
                                            method="GET"
                                            path="/api/conversations/{id}"
                                        />
                                        <EndpointRow
                                            method="POST"
                                            path="/api/conversations/{id}/messages/stream"
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="rounded-lg">
                                    <CardHeader>
                                        <CardTitle>Streaming SSE</CardTitle>
                                        <CardDescription>
                                            Urutan event yang diterima frontend.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <RuntimeRow
                                            icon={MessageSquare}
                                            label="conversation_started"
                                            value="awal stream"
                                        />
                                        <RuntimeRow
                                            icon={Sparkles}
                                            label="text_delta"
                                            value="token bertahap"
                                        />
                                        <RuntimeRow
                                            icon={CheckCircle2}
                                            label="message_complete"
                                            value="final message"
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </section>

                        <section
                            id="knowledge"
                            className="grid scroll-mt-24 gap-6 xl:grid-cols-2"
                        >
                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Data bot</CardTitle>
                                    <CardDescription>
                                        Sumber data yang dipakai chatbot untuk
                                        menjawab pertanyaan user.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {knowledgeItems.map((item) => (
                                        <div
                                            key={item.title}
                                            className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="rounded-md bg-muted p-2">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">
                                                        {item.title}
                                                    </p>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {item.source} ·{' '}
                                                        {item.chunks} chunks
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge
                                                variant={
                                                    item.status === 'active'
                                                        ? 'secondary'
                                                        : 'outline'
                                                }
                                            >
                                                {knowledgeStatusLabel(
                                                    item.status,
                                                )}
                                            </Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Kesiapan data</CardTitle>
                                    <CardDescription>
                                        Ringkasan kualitas sumber jawaban bot.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <QualityBar
                                        label="Jawaban pakai data bot"
                                        value={82}
                                    />
                                    <QualityBar
                                        label="Pencarian data siap"
                                        value={74}
                                    />
                                    <QualityBar
                                        label="Sumber jawaban tercatat"
                                        value={68}
                                    />
                                </CardContent>
                            </Card>
                        </section>

                        <section
                            id="runtime"
                            className="grid scroll-mt-24 gap-6 xl:grid-cols-2"
                        >
                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Pengaturan AI</CardTitle>
                                    <CardDescription>
                                        Informasi model dan proses AI yang
                                        menjalankan chatbot.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-3">
                                    <RuntimePanel
                                        icon={Sparkles}
                                        title="Penyedia AI"
                                        value="OpenAI compatible"
                                        detail="Tempat aplikasi mengirim request AI."
                                    />
                                    <RuntimePanel
                                        icon={Bot}
                                        title="Model"
                                        value="gpt-5.4-mini"
                                        detail="Model yang dipakai untuk membuat balasan chatbot."
                                    />
                                    <RuntimePanel
                                        icon={Clock3}
                                        title="Cara balasan"
                                        value="SSE aktif"
                                        detail="Bot bisa membalas biasa atau streaming bertahap."
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Status AI</CardTitle>
                                    <CardDescription>
                                        Ringkasan kondisi proses jawaban bot.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <QualityBar
                                        label="Balasan streaming sukses"
                                        value={91}
                                    />
                                    <QualityBar
                                        label="Judul chat otomatis"
                                        value={76}
                                    />
                                    <QualityBar
                                        label="Jawaban aman"
                                        value={84}
                                    />
                                </CardContent>
                            </Card>
                        </section>

                        <section
                            id="moderation"
                            className="grid scroll-mt-24 gap-6 xl:grid-cols-2"
                        >
                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Keamanan chat</CardTitle>
                                    <CardDescription>
                                        Proteksi agar chatbot tetap aman dan
                                        tidak disalahgunakan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-2">
                                    <GuardrailItem
                                        title="Filter pesan user"
                                        description="Pesan dicek dulu sebelum dikirim ke AI."
                                    />
                                    <GuardrailItem
                                        title="Batas request"
                                        description="Chat dan login dibatasi agar tidak spam."
                                    />
                                    <GuardrailItem
                                        title="Privasi percakapan"
                                        description="User hanya bisa membuka chat miliknya sendiri."
                                    />
                                    <GuardrailItem
                                        title="Anti request duplikat"
                                        description="Request chat yang sama tidak diproses berkali-kali."
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Kualitas jawaban</CardTitle>
                                    <CardDescription>
                                        Sinyal operasional dari chat runtime.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <QualityBar
                                        label="Selesai tanpa eskalasi"
                                        value={74}
                                    />
                                    <QualityBar
                                        label="Feedback positif"
                                        value={68}
                                    />
                                    <div className="rounded-md border border-[#f5d08b] bg-[#fff4df] p-3 text-sm text-[#8a3c06] dark:border-[#7c4a08] dark:bg-[#3b2508] dark:text-[#f7c56b]">
                                        <div className="flex items-center gap-2 font-medium">
                                            <AlertTriangle className="h-4 w-4" />
                                            Perlu review
                                        </div>
                                        <p className="mt-1 leading-5">
                                            Beberapa pertanyaan user belum
                                            memiliki sumber knowledge yang kuat.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <section
                            id="auth"
                            className="grid scroll-mt-24 gap-6 xl:grid-cols-2"
                        >
                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Admin aktif</CardTitle>
                                    <CardDescription>
                                        Session pengguna saat ini.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <UserInfo user={auth.user} showEmail />
                                    <Separator className="my-4" />
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">
                                                Role
                                            </p>
                                            <p className="mt-1 font-medium">
                                                {String(
                                                    auth.user.role ?? 'admin',
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">
                                                Email
                                            </p>
                                            <p className="mt-1 font-medium">
                                                {auth.user.email_verified_at
                                                    ? 'Verified'
                                                    : 'Unverified'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-lg">
                                <CardHeader>
                                    <CardTitle>Data login pengguna</CardTitle>
                                    <CardDescription>
                                        Endpoint yang dipakai frontend untuk
                                        login, register, cek user, dan logout.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-2">
                                    <EndpointRow
                                        method="GET"
                                        path="/api/auth/csrf"
                                    />
                                    <EndpointRow
                                        method="POST"
                                        path="/api/auth/login"
                                    />
                                    <EndpointRow
                                        method="POST"
                                        path="/api/auth/register"
                                    />
                                    <EndpointRow
                                        method="GET"
                                        path="/api/auth/me"
                                    />
                                    <EndpointRow
                                        method="POST"
                                        path="/api/auth/logout"
                                    />
                                    <EndpointRow
                                        method="GET"
                                        path="/auth/google/callback"
                                    />
                                </CardContent>
                            </Card>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}

function EndpointRow({ method, path }: { method: string; path: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
            <Badge variant="secondary" className="font-mono">
                {method}
            </Badge>
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                {path}
            </span>
        </div>
    );
}

function MetricCard({ metric }: { metric: Metric }) {
    const Icon = metricIcons[metric.icon] ?? LayoutDashboard;

    return (
        <Card className="rounded-lg">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                    <CardDescription>{metric.label}</CardDescription>
                    <CardTitle className="mt-3 text-2xl">
                        {metric.value}
                    </CardTitle>
                </div>
                <span
                    className={`rounded-md p-2 ring-1 ${toneClasses[metric.tone]}`}
                >
                    <Icon className="h-4 w-4" />
                </span>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    {metric.description}
                </p>
            </CardContent>
        </Card>
    );
}

function statusClass(status: string) {
    return (
        statusClasses[status] ??
        'border-transparent bg-muted text-muted-foreground'
    );
}

function conversationStatusLabel(status: string) {
    if (status === 'active') {
        return 'Aktif';
    }

    return status;
}

function knowledgeStatusLabel(status: string) {
    if (status === 'active') {
        return 'Aktif';
    }

    if (status === 'empty') {
        return 'Kosong';
    }

    return status;
}

function RuntimePanel({
    icon: Icon,
    title,
    value,
    detail,
}: {
    icon: LucideIcon;
    title: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-primary" />
                {title}
            </div>
            <p className="mt-3 text-sm font-semibold">{value}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {detail}
            </p>
        </div>
    );
}

function GuardrailItem({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {title}
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

function RuntimeRow({
    icon: Icon,
    label,
    value,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

function TokenCell({ value }: { value: string }) {
    return (
        <p className="hidden text-sm text-muted-foreground tabular-nums md:block">
            {value}
        </p>
    );
}

function EmptyTableRow({ text }: { text: string }) {
    return (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {text}
        </div>
    );
}

function QualityBar({ label, value }: { label: string; value: number }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('id-ID').format(value);
}
