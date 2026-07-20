import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    Bot,
    ChevronDown,
    Clock3,
    Download,
    FileText,
    LayoutDashboard,
    MessageSquare,
    Printer,
    Search,
    ShieldCheck,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminConversationChart } from '@/components/admin-conversation-chart';
import { AdminFeedbackBarChart } from '@/components/admin-feedback-bar-chart';
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
    id?: number;
    dislikes: number;
    email?: string;
    lastMessageAt?: string | null;
    latestMessage?: string;
    latestRole?: string | null;
    likes: number;
    messages?: number;
    messageCount?: number;
    model?: string | null;
    needsReview?: boolean;
    title?: string;
    tokenTotal?: number;
    user: string;
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

type AdminUserItem = {
    name: string;
    email: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
    joinedAt: string;
    lastSeen: string;
    conversations: number;
};

type AdminActivityItem = {
    id: number;
    admin: string;
    email: string;
    category: 'auth' | 'conversation' | 'user' | 'report' | 'system';
    action: string;
    target: string;
    detail: string;
    ipAddress: string;
    createdAt?: string | null;
    time: string;
};

type ReportPeriod = 'week' | 'month' | 'year';

type ChatTrendItem = {
    date: string;
    conversations: number;
    resolved: number;
};

type SectionId =
    | 'overview'
    | 'users'
    | 'activity-log'
    | 'token-usage'
    | 'chat-trend'
    | 'chat-api'
    | 'knowledge'
    | 'runtime'
    | 'moderation'
    | 'auth';

type AdminPageProps = {
    auth: Auth;
    section?: SectionId;
    metrics?: Metric[];
    conversations?: Conversation[];
    tokenUsageItems?: TokenUsageItem[];
    adminUsers?: AdminUserItem[];
    adminActivityItems?: AdminActivityItem[];
    chatTrendItems?: ChatTrendItem[];
    feedbackChartItems?: {
        month: string;
        dislikes: number;
        likes: number;
    }[];
    totals?: {
        totalTokenUsage: number;
        totalLikes: number;
        totalDislikes: number;
        activeUsers: number;
        adminUserCount: number;
        totalUserConversations: number;
        activityToday: number;
        conversationActions: number;
        reportExports: number;
    };
    filters?: {
        period?: ReportPeriod | null;
        search?: string;
    };
};

type ActivityLogTotals = Pick<
    NonNullable<AdminPageProps['totals']>,
    'activityToday' | 'conversationActions' | 'reportExports'
>;

type ActivityLogLivePayload = {
    adminActivityItems: AdminActivityItem[];
    filters: {
        period: ReportPeriod;
        search: string;
    };
    totals: ActivityLogTotals;
};

const metricIcons = {
    message: MessageSquare,
    sparkles: Sparkles,
    thumbsDown: ThumbsDown,
    thumbsUp: ThumbsUp,
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
        dislikes: 1,
        likes: 24,
        user: 'Nadia Putri',
        status: 'Selesai',
        time: '2 menit lalu',
    },
    {
        dislikes: 0,
        likes: 18,
        user: 'Raka Firmansyah',
        status: 'Berjalan',
        time: '8 menit lalu',
    },
    {
        dislikes: 4,
        likes: 9,
        user: 'Ayu Lestari',
        status: 'Selesai',
        time: '21 menit lalu',
    },
    {
        dislikes: 2,
        likes: 21,
        user: 'Bagus Pratama',
        status: 'Selesai',
        time: '35 menit lalu',
    },
];

const adminUsers: AdminUserItem[] = [
    {
        name: 'Admin Deka',
        email: 'admin@deka.dev',
        role: 'admin',
        status: 'active',
        joinedAt: '13 Jul 2026',
        lastSeen: 'Baru saja',
        conversations: 11,
    },
    {
        name: 'Nadia Putri',
        email: 'nadia@example.com',
        role: 'user',
        status: 'active',
        joinedAt: '14 Jul 2026',
        lastSeen: '2 menit lalu',
        conversations: 42,
    },
    {
        name: 'Raka Firmansyah',
        email: 'raka@example.com',
        role: 'user',
        status: 'active',
        joinedAt: '15 Jul 2026',
        lastSeen: '8 menit lalu',
        conversations: 36,
    },
    {
        name: 'Ayu Lestari',
        email: 'ayu@example.com',
        role: 'user',
        status: 'active',
        joinedAt: '16 Jul 2026',
        lastSeen: '21 menit lalu',
        conversations: 28,
    },
    {
        name: 'Bagus Pratama',
        email: 'bagus@example.com',
        role: 'user',
        status: 'inactive',
        joinedAt: '17 Jul 2026',
        lastSeen: 'Kemarin',
        conversations: 9,
    },
];

const adminActivityItems: AdminActivityItem[] = [
    {
        id: 1,
        admin: 'Admin Deka',
        email: 'admin@deka.dev',
        category: 'auth',
        action: 'Login dashboard',
        target: 'Admin panel',
        detail: 'Masuk ke halaman Dashboard Ringkasan.',
        ipAddress: '192.168.10.14',
        time: 'Baru saja',
    },
    {
        id: 2,
        admin: 'Admin Deka',
        email: 'admin@deka.dev',
        category: 'conversation',
        action: 'Meninjau feedback',
        target: 'Feedback AI',
        detail: 'Melihat ringkasan like dan dislike tanpa membuka isi chat.',
        ipAddress: '192.168.10.14',
        time: '3 menit lalu',
    },
    {
        id: 3,
        admin: 'Admin Deka',
        email: 'admin@deka.dev',
        category: 'report',
        action: 'Export laporan',
        target: 'Feedback AI',
        detail: 'Mengunduh ringkasan feedback bulan ini.',
        ipAddress: '192.168.10.14',
        time: '12 menit lalu',
    },
    {
        id: 4,
        admin: 'Admin Deka',
        email: 'admin@deka.dev',
        category: 'user',
        action: 'Cek data pengguna',
        target: 'Raka Firmansyah',
        detail: 'Membuka data user aktif dan jumlah chat pengguna.',
        ipAddress: '192.168.10.14',
        time: '18 menit lalu',
    },
    {
        id: 5,
        admin: 'Admin Deka',
        email: 'admin@deka.dev',
        category: 'system',
        action: 'Melihat token usage',
        target: 'Token AI',
        detail: 'Memantau pemakaian token berdasarkan pengguna aktif.',
        ipAddress: '192.168.10.14',
        time: '27 menit lalu',
    },
    {
        id: 6,
        admin: 'Admin Deka',
        email: 'admin@deka.dev',
        category: 'auth',
        action: 'Logout dashboard',
        target: 'Admin panel',
        detail: 'Keluar dari session admin sebelumnya.',
        ipAddress: '192.168.10.14',
        time: 'Kemarin',
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
const totalLikes = conversations.reduce(
    (total, conversation) => total + conversation.likes,
    0,
);
const totalDislikes = conversations.reduce(
    (total, conversation) => total + conversation.dislikes,
    0,
);
const activeUsers = adminUsers.filter(
    (item) => item.status === 'active',
).length;
const adminUserCount = adminUsers.filter(
    (item) => item.role === 'admin',
).length;
const totalUserConversations = adminUsers.reduce(
    (total, item) => total + item.conversations,
    0,
);

const metrics: Metric[] = [
    {
        label: 'Total Percakapan',
        value: formatNumber(conversations.length),
        description: 'Seluruh percakapan yang masuk di dashboard.',
        tone: 'blue',
        icon: 'message',
    },
    {
        label: 'Total Like',
        value: formatNumber(totalLikes),
        description: 'Feedback positif dari jawaban chatbot.',
        tone: 'green',
        icon: 'thumbsUp',
    },
    {
        label: 'Total Dislike',
        value: formatNumber(totalDislikes),
        description: 'Feedback negatif yang perlu dipantau.',
        tone: 'amber',
        icon: 'thumbsDown',
    },
    {
        label: 'User Aktif',
        value: formatNumber(activeUsers),
        description: 'Pengguna aktif dari data dummy saat ini.',
        tone: 'neutral',
        icon: 'users',
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
        label: 'Dashboard Ringkasan',
        description: 'Total percakapan, like, dislike, dan user aktif',
        icon: LayoutDashboard,
    },
    {
        id: 'token-usage',
        label: 'Token Usage',
        description: 'Pemakaian token AI per pengguna',
        icon: Sparkles,
    },
    {
        id: 'users',
        label: 'Kelola Pengguna',
        description: 'Admin, user, login, dan role',
        icon: Users,
    },
    {
        id: 'activity-log',
        label: 'Log Aktivitas',
        description: 'Riwayat aktivitas admin dan aksi yang dilakukan',
        icon: Clock3,
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
    inactive:
        'border-transparent bg-[#eef4fb] text-[#40566f] dark:bg-[#10233a] dark:text-[#b7c7d9]',
    Selesai:
        'border-transparent bg-[#e8f2ff] text-[#155fc4] dark:bg-[#12365f] dark:text-[#b8d9ff]',
    Berjalan:
        'border-transparent bg-[#eaf8ff] text-[#0369a1] dark:bg-[#082f49] dark:text-[#7dd3fc]',
};

const activityCategoryClasses: Record<AdminActivityItem['category'], string> = {
    auth: 'border-transparent bg-[#e8f2ff] text-[#155fc4] dark:bg-[#12365f] dark:text-[#b8d9ff]',
    conversation:
        'border-transparent bg-[#eaf3ff] text-[#2f80ed] dark:bg-[#102b4a] dark:text-[#8fc1ff]',
    user: 'border-transparent bg-[#eef4fb] text-[#40566f] dark:bg-[#10233a] dark:text-[#b7c7d9]',
    report: 'border-transparent bg-[#e8f2ff] text-[#155fc4] dark:bg-[#12365f] dark:text-[#b8d9ff]',
    system: 'border-transparent bg-[#eef4fb] text-[#40566f] dark:bg-[#10233a] dark:text-[#b7c7d9]',
};

const sectionHref = (sectionId: SectionId) => `/admin/${sectionId}`;

const isSectionId = (value: unknown): value is SectionId =>
    typeof value === 'string' && navigation.some((item) => item.id === value);

function updateActivityPeriod(period: ReportPeriod, search?: string) {
    const normalizedSearch = search?.trim();

    router.get(
        sectionHref('activity-log'),
        {
            period,
            ...(normalizedSearch ? { search: normalizedSearch } : {}),
        },
        { preserveState: false },
    );
}

export default function AdminPage() {
    const {
        auth,
        section,
        metrics = [],
        conversations = [],
        tokenUsageItems = [],
        adminUsers = [],
        adminActivityItems = [],
        chatTrendItems = [],
        feedbackChartItems = [],
        totals,
        filters,
    } = usePage<AdminPageProps>().props;
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [liveActivityItems, setLiveActivityItems] =
        useState(adminActivityItems);
    const [liveActivityTotals, setLiveActivityTotals] =
        useState<ActivityLogTotals | null>(null);
    const [activityLiveStatus, setActivityLiveStatus] = useState<
        'live' | 'updating' | 'error'
    >('live');
    const activeSection = isSectionId(section) ? section : 'overview';
    const totalTokenUsage =
        totals?.totalTokenUsage ??
        tokenUsageItems.reduce((total, item) => total + item.totalTokens, 0);
    const activeUsers =
        totals?.activeUsers ??
        adminUsers.filter((item) => item.status === 'active').length;
    const adminUserCount =
        totals?.adminUserCount ??
        adminUsers.filter((item) => item.role === 'admin').length;
    const totalUserConversations =
        totals?.totalUserConversations ??
        adminUsers.reduce((total, item) => total + item.conversations, 0);
    const activityPeriod = filters?.period ?? 'month';
    const activityStats = {
        activityToday:
            liveActivityTotals?.activityToday ?? totals?.activityToday ?? 0,
        conversationActions:
            liveActivityTotals?.conversationActions ??
            totals?.conversationActions ??
            0,
        reportExports:
            liveActivityTotals?.reportExports ?? totals?.reportExports ?? 0,
    };
    const profileInitials = auth.user.name
        .split(' ')
        .map((name) => name[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const activeNavigation = navigation.find(
        (item) => item.id === activeSection,
    );

    useEffect(() => {
        setLiveActivityItems(adminActivityItems);
        setLiveActivityTotals(null);
    }, [adminActivityItems]);

    useEffect(() => {
        if (activeSection !== 'activity-log') {
            return;
        }

        const controller = new AbortController();

        const refreshActivityLog = async () => {
            const url = new URL(
                '/admin/activity-log/items',
                window.location.origin,
            );
            const normalizedSearch = filters?.search?.trim();

            url.searchParams.set('period', activityPeriod);

            if (normalizedSearch) {
                url.searchParams.set('search', normalizedSearch);
            }

            try {
                setActivityLiveStatus('updating');

                const response = await fetch(url, {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Activity log refresh failed`);
                }

                const payload =
                    (await response.json()) as ActivityLogLivePayload;

                setLiveActivityItems(payload.adminActivityItems);
                setLiveActivityTotals(payload.totals);
                setActivityLiveStatus('live');
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error(error);
                setActivityLiveStatus('error');
            }
        };

        void refreshActivityLog();

        const interval = window.setInterval(refreshActivityLog, 10_000);

        return () => {
            controller.abort();
            window.clearInterval(interval);
        };
    }, [activeSection, activityPeriod, filters?.search]);

    return (
        <>
            <Head title="Admin Dashboard" />

            <div className="h-screen overflow-hidden bg-background text-foreground">
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
                            <Link
                                key={item.label}
                                href={sectionHref(item.id)}
                                title={
                                    sidebarCollapsed ? item.label : undefined
                                }
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
                            </Link>
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
                                        router.visit(sectionHref('users'))
                                    }
                                />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </aside>

                <div
                    className={`flex h-screen min-w-0 flex-col transition-[padding] duration-200 ${
                        sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
                    }`}
                >
                    <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
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
                                    defaultValue={filters?.search ?? ''}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter') {
                                            return;
                                        }

                                        const value =
                                            event.currentTarget.value.trim();

                                        router.get(
                                            sectionHref(activeSection),
                                            {
                                                ...(value === ''
                                                    ? {}
                                                    : { search: value }),
                                                ...(activeSection ===
                                                'activity-log'
                                                    ? {
                                                          period: activityPeriod,
                                                      }
                                                    : {}),
                                            },
                                            { preserveState: false },
                                        );
                                    }}
                                    placeholder="Cari data dashboard"
                                />
                            </div>
                        </div>
                    </header>

                    <main className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-hidden px-4 py-6 md:px-6">
                        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:hidden">
                            {navigation.map((item) => (
                                <Button
                                    key={item.id}
                                    asChild
                                    size="sm"
                                    variant={
                                        activeSection === item.id
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="shrink-0"
                                >
                                    <Link href={sectionHref(item.id)}>
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </div>

                        {activeSection === 'overview' && (
                            <section className="flex min-h-0 flex-1 flex-col gap-6">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    {metrics.map((metric) => (
                                        <MetricCard
                                            key={metric.label}
                                            metric={metric}
                                        />
                                    ))}
                                </div>

                                <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
                                    <AdminConversationChart
                                        data={chatTrendItems}
                                        className="flex min-h-0 flex-col"
                                        chartClassName="h-full min-h-[240px]"
                                    />
                                    <AdminFeedbackBarChart
                                        data={feedbackChartItems}
                                        className="flex min-h-0 flex-col"
                                        chartClassName="h-full min-h-[240px]"
                                    />
                                    <AdminTokenUsageChart
                                        data={tokenUsageItems}
                                        className="flex min-h-0 flex-col"
                                        chartClassName="h-full min-h-[240px]"
                                    />
                                </div>
                            </section>
                        )}

                        {activeSection === 'token-usage' && (
                            <section className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                                <Card className="rounded-lg">
                                    <CardHeader className="gap-3 pb-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Usage token per user
                                                </CardTitle>
                                                <CardDescription>
                                                    Ringkasan token AI yang
                                                    dipakai tiap pengguna. Input
                                                    adalah token dari pertanyaan
                                                    dan konteks, output adalah
                                                    token jawaban AI.
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
                                            <div className="min-w-0">
                                                <div className="grid grid-cols-[minmax(140px,1fr)_70px_96px_96px_106px] items-center gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                    <span>User</span>
                                                    <span className="text-right">
                                                        Req
                                                    </span>
                                                    <span className="text-right">
                                                        Input
                                                    </span>
                                                    <span className="text-right">
                                                        Output
                                                    </span>
                                                    <span className="text-right">
                                                        Total
                                                    </span>
                                                </div>
                                                {tokenUsageItems.length > 0 ? (
                                                    tokenUsageItems.map(
                                                        (item) => (
                                                            <div
                                                                key={item.email}
                                                                className="grid grid-cols-[minmax(140px,1fr)_70px_96px_96px_106px] items-center gap-3 border-b px-4 py-3 last:border-b-0"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="truncate text-sm leading-5 font-medium">
                                                                            {
                                                                                item.user
                                                                            }
                                                                        </p>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="hidden text-[10px] capitalize sm:inline-flex"
                                                                        >
                                                                            {
                                                                                item.role
                                                                            }
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="truncate text-xs text-muted-foreground">
                                                                        {
                                                                            item.email
                                                                        }
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
                                                                <div className="text-right">
                                                                    <p className="text-sm leading-5 font-semibold tabular-nums">
                                                                        {formatNumber(
                                                                            item.totalTokens,
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground tabular-nums">
                                                                        {formatNumber(
                                                                            Math.round(
                                                                                item.totalTokens /
                                                                                    Math.max(
                                                                                        item.requests,
                                                                                        1,
                                                                                    ),
                                                                            ),
                                                                        )}
                                                                        /req
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <EmptyTableRow text="Belum ada pemakaian token dari chat AI." />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <AdminTokenUsageChart
                                    data={tokenUsageItems}
                                    className="flex flex-col"
                                    chartClassName="h-[240px] max-h-[240px] max-w-[260px]"
                                />
                            </section>
                        )}

                        {activeSection === 'chat-trend' && (
                            <section className="min-h-0">
                                <AdminConversationChart data={chatTrendItems} />
                            </section>
                        )}

                        {activeSection === 'knowledge' && (
                            <section className="grid min-h-0 gap-6 xl:grid-cols-2">
                                <Card className="rounded-lg">
                                    <CardHeader>
                                        <CardTitle>Data bot</CardTitle>
                                        <CardDescription>
                                            Sumber data yang dipakai chatbot
                                            untuk menjawab pertanyaan user.
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
                                            Ringkasan kualitas sumber jawaban
                                            bot.
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
                        )}

                        {activeSection === 'runtime' && (
                            <section className="grid min-h-0 gap-6 xl:grid-cols-2">
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
                                            Ringkasan kondisi proses jawaban
                                            bot.
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
                        )}

                        {activeSection === 'moderation' && (
                            <section className="grid min-h-0 gap-6 xl:grid-cols-2">
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
                                            Sinyal operasional dari chat
                                            runtime.
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
                                                memiliki sumber knowledge yang
                                                kuat.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {activeSection === 'users' && (
                            <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    <UserMetricCard
                                        icon={Users}
                                        label="Total user"
                                        tone="blue"
                                        value={formatNumber(adminUsers.length)}
                                    />
                                    <UserMetricCard
                                        icon={Users}
                                        label="User aktif"
                                        tone="green"
                                        value={formatNumber(activeUsers)}
                                    />
                                    <UserMetricCard
                                        icon={ShieldCheck}
                                        label="Admin"
                                        tone="neutral"
                                        value={formatNumber(adminUserCount)}
                                    />
                                    <UserMetricCard
                                        icon={MessageSquare}
                                        label="Total chat"
                                        tone="amber"
                                        value={formatNumber(
                                            totalUserConversations,
                                        )}
                                    />
                                </div>

                                <Card className="flex min-h-0 flex-col rounded-lg">
                                    <CardHeader>
                                        <CardTitle>Daftar Pengguna</CardTitle>
                                        <CardDescription>
                                            User yang terdaftar di chatbot Deka.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-hidden rounded-md border">
                                            <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[minmax(260px,1fr)_140px_140px_140px_160px]">
                                                <span>Pengguna</span>
                                                <span className="hidden md:block">
                                                    Role
                                                </span>
                                                <span className="hidden md:block">
                                                    Status
                                                </span>
                                                <span className="hidden md:block">
                                                    Chat
                                                </span>
                                                <span>Aktif</span>
                                            </div>

                                            {adminUsers.length > 0 ? (
                                                adminUsers.map((item) => (
                                                    <div
                                                        key={item.email}
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(260px,1fr)_140px_140px_140px_160px]"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="truncate text-sm font-medium">
                                                                    {item.name}
                                                                </p>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] capitalize md:hidden"
                                                                >
                                                                    {item.role}
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                {item.email}
                                                            </p>
                                                        </div>
                                                        <div className="hidden md:block">
                                                            <Badge
                                                                variant="outline"
                                                                className="capitalize"
                                                            >
                                                                {item.role}
                                                            </Badge>
                                                        </div>
                                                        <div className="hidden md:block">
                                                            <Badge
                                                                variant="outline"
                                                                className={statusClass(
                                                                    item.status,
                                                                )}
                                                            >
                                                                {userStatusLabel(
                                                                    item.status,
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <p className="hidden text-sm text-muted-foreground tabular-nums md:block">
                                                            {formatNumber(
                                                                item.conversations,
                                                            )}
                                                        </p>
                                                        <p className="text-sm whitespace-nowrap text-muted-foreground">
                                                            {item.lastSeen}
                                                        </p>
                                                    </div>
                                                ))
                                            ) : (
                                                <EmptyTableRow text="Belum ada pengguna yang cocok." />
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {activeSection === 'activity-log' && (
                            <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    <UserMetricCard
                                        icon={Clock3}
                                        label="Aktivitas hari ini"
                                        tone="blue"
                                        value={formatNumber(
                                            activityStats.activityToday,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={ShieldCheck}
                                        label="Admin aktif"
                                        tone="neutral"
                                        value={formatNumber(adminUserCount)}
                                    />
                                    <UserMetricCard
                                        icon={MessageSquare}
                                        label="Aksi feedback"
                                        tone="green"
                                        value={formatNumber(
                                            activityStats.conversationActions,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={BarChart3}
                                        label="Export laporan"
                                        tone="amber"
                                        value={formatNumber(
                                            activityStats.reportExports,
                                        )}
                                    />
                                </div>

                                <Card className="flex min-h-0 flex-col rounded-lg">
                                    <CardHeader className="gap-3">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Log Aktivitas Admin
                                                </CardTitle>
                                                <CardDescription>
                                                    Baca dari kiri: admin,
                                                    kategori, aktivitas, IP, dan
                                                    waktu. Update otomatis tiap
                                                    10 detik.
                                                </CardDescription>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        activityLiveStatus ===
                                                        'error'
                                                            ? 'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
                                                            : 'border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                                                    }
                                                >
                                                    {activityLiveStatus ===
                                                    'error'
                                                        ? 'Realtime tertunda'
                                                        : activityLiveStatus ===
                                                            'updating'
                                                          ? 'Memuat realtime'
                                                          : 'Live realtime'}
                                                </Badge>
                                                <Button
                                                    variant={
                                                        activityPeriod ===
                                                        'week'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        updateActivityPeriod(
                                                            'week',
                                                            filters?.search,
                                                        )
                                                    }
                                                >
                                                    <Clock3 className="h-4 w-4" />
                                                    Mingguan
                                                </Button>
                                                <Button
                                                    variant={
                                                        activityPeriod ===
                                                        'month'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        updateActivityPeriod(
                                                            'month',
                                                            filters?.search,
                                                        )
                                                    }
                                                >
                                                    <Clock3 className="h-4 w-4" />
                                                    Bulanan
                                                </Button>
                                                <Button
                                                    variant={
                                                        activityPeriod ===
                                                        'year'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        updateActivityPeriod(
                                                            'year',
                                                            filters?.search,
                                                        )
                                                    }
                                                >
                                                    <Clock3 className="h-4 w-4" />
                                                    Tahunan
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        exportAdminActivityReport(
                                                            activityPeriod,
                                                            liveActivityItems,
                                                        )
                                                    }
                                                >
                                                    <Download className="h-4 w-4" />
                                                    CSV
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        printAdminDashboardReport(
                                                            'month',
                                                            metrics,
                                                            conversations,
                                                            tokenUsageItems,
                                                            liveActivityItems,
                                                        )
                                                    }
                                                >
                                                    <Printer className="h-4 w-4" />
                                                    Cetak Semua
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-x-auto overflow-y-auto rounded-md border">
                                            <div className="min-w-[880px]">
                                                <div className="grid grid-cols-[minmax(220px,1fr)_140px_minmax(260px,1.2fr)_150px_150px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                    <span>Admin</span>
                                                    <span>Kategori</span>
                                                    <span>Aktivitas</span>
                                                    <span>IP</span>
                                                    <span>Waktu</span>
                                                </div>

                                                {liveActivityItems.length >
                                                0 ? (
                                                    liveActivityItems.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                className="grid grid-cols-[minmax(220px,1fr)_140px_minmax(260px,1.2fr)_150px_150px] gap-3 border-b px-4 py-4 last:border-b-0"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-medium">
                                                                        {
                                                                            item.admin
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                        {
                                                                            item.email
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={activityCategoryClass(
                                                                            item.category,
                                                                        )}
                                                                    >
                                                                        {activityCategoryLabel(
                                                                            item.category,
                                                                        )}
                                                                    </Badge>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-medium">
                                                                        {
                                                                            item.action
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                        {
                                                                            item.target
                                                                        }{' '}
                                                                        ·{' '}
                                                                        {
                                                                            item.detail
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <p className="font-mono text-sm text-muted-foreground">
                                                                    {
                                                                        item.ipAddress
                                                                    }
                                                                </p>
                                                                <p className="text-sm whitespace-nowrap text-muted-foreground">
                                                                    {item.time}
                                                                </p>
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <EmptyTableRow text="Belum ada aktivitas admin yang tercatat." />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>
                        )}
                    </main>
                </div>
            </div>
        </>
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

function userStatusLabel(status: AdminUserItem['status']) {
    return status === 'active' ? 'Aktif' : 'Nonaktif';
}

function activityCategoryClass(category: AdminActivityItem['category']) {
    return activityCategoryClasses[category] ?? activityCategoryClasses.system;
}

function activityCategoryLabel(category: AdminActivityItem['category']) {
    const labels: Record<AdminActivityItem['category'], string> = {
        auth: 'Login',
        conversation: 'Percakapan',
        user: 'Pengguna',
        report: 'Laporan',
        system: 'Sistem',
    };

    return labels[category] ?? labels.system;
}

function reportPeriodLabel(period: ReportPeriod) {
    const labels: Record<ReportPeriod, string> = {
        week: 'Mingguan',
        month: 'Bulanan',
        year: 'Tahunan',
    };

    return labels[period];
}

function exportAdminActivityReport(
    period: ReportPeriod,
    items: AdminActivityItem[],
) {
    const periodLabel = reportPeriodLabel(period);
    const rows = items.map((item) => [
        item.admin,
        item.email,
        activityCategoryLabel(item.category),
        item.action,
        item.target,
        item.detail,
        item.ipAddress,
        item.time,
    ]);
    const csv = [
        [
            'Admin',
            'Email',
            'Kategori',
            'Aktivitas',
            'Target',
            'Detail',
            'IP',
            'Waktu',
        ],
        ...rows,
    ]
        .map((row) =>
            row
                .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
                .join(','),
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `log-aktivitas-admin-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    console.info(`Laporan aktivitas admin ${periodLabel} diexport.`);
}

function printAdminDashboardReport(
    period: ReportPeriod,
    metricItems: Metric[],
    conversationItems: Conversation[],
    tokenItems: TokenUsageItem[],
    activityItems: AdminActivityItem[],
) {
    const periodLabel = reportPeriodLabel(period);
    const metricCards = metricItems
        .map(
            (metric) => `
                <div class="summary-card">
                    <span>${metric.label}</span>
                    <strong>${metric.value}</strong>
                    <small>${metric.description}</small>
                </div>
            `,
        )
        .join('');
    const feedbackRows = conversationItems
        .map(
            (item) => `
                <tr>
                    <td>${item.user}</td>
                    <td>${formatNumber(item.likes)}</td>
                    <td>${formatNumber(item.dislikes)}</td>
                    <td>${conversationStatusLabel(item.status)}</td>
                    <td>${item.time}</td>
                </tr>
            `,
        )
        .join('');
    const tokenRows = tokenItems
        .map(
            (item) => `
                <tr>
                    <td>${item.user}</td>
                    <td>${item.role}</td>
                    <td>${formatNumber(item.requests)}</td>
                    <td>${formatNumber(item.promptTokens)}</td>
                    <td>${formatNumber(item.completionTokens)}</td>
                    <td>${formatNumber(item.totalTokens)}</td>
                </tr>
            `,
        )
        .join('');
    const printableRows = activityItems
        .map(
            (item) => `
                <tr>
                    <td>${item.admin}</td>
                    <td>${activityCategoryLabel(item.category)}</td>
                    <td>${item.action}</td>
                    <td>${item.target}</td>
                    <td>${item.ipAddress}</td>
                    <td>${item.time}</td>
                </tr>
            `,
        )
        .join('');
    const printWindow = window.open('', '_blank', 'width=960,height=720');

    if (!printWindow) {
        window.print();
        return;
    }

    printWindow.document.write(`
        <html>
            <head>
                <title>Laporan Dashboard Admin ${periodLabel}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
                    h1 { margin: 0 0 6px; font-size: 22px; }
                    h2 { margin: 28px 0 10px; font-size: 16px; }
                    p { margin: 0 0 18px; color: #526782; }
                    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0 22px; }
                    .summary-card { border: 1px solid #d8e4f2; border-radius: 8px; padding: 12px; }
                    .summary-card span { display: block; color: #526782; font-size: 12px; }
                    .summary-card strong { display: block; margin: 8px 0; font-size: 24px; }
                    .summary-card small { color: #526782; line-height: 1.4; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #d8e4f2; padding: 10px; text-align: left; vertical-align: top; }
                    th { background: #eef4fb; font-size: 11px; text-transform: uppercase; }
                    @media print { body { padding: 0; } .summary { grid-template-columns: repeat(2, 1fr); } }
                </style>
            </head>
            <body>
                <h1>Laporan Dashboard Admin ${periodLabel}</h1>
                <p>Ringkasan dashboard, feedback, token usage, dan aktivitas admin Deka.</p>

                <h2>Dashboard Ringkasan</h2>
                <div class="summary">${metricCards}</div>

                <h2>Feedback AI</h2>
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Like</th>
                            <th>Dislike</th>
                            <th>Status</th>
                            <th>Waktu</th>
                        </tr>
                    </thead>
                    <tbody>${feedbackRows}</tbody>
                </table>

                <h2>Token Usage</h2>
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Request</th>
                            <th>Prompt</th>
                            <th>Completion</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>${tokenRows}</tbody>
                </table>

                <h2>Log Aktivitas Admin</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Admin</th>
                            <th>Kategori</th>
                            <th>Aktivitas</th>
                            <th>Target</th>
                            <th>IP</th>
                            <th>Waktu</th>
                        </tr>
                    </thead>
                    <tbody>${printableRows}</tbody>
                </table>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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

function TokenCell({ value }: { value: string }) {
    return (
        <p className="text-right text-sm text-muted-foreground tabular-nums">
            {value}
        </p>
    );
}

function FeedbackCell({
    icon: Icon,
    value,
}: {
    icon: LucideIcon;
    value: number;
}) {
    return (
        <div className="hidden items-center gap-2 text-sm font-medium text-muted-foreground md:flex">
            <Icon className="h-4 w-4 text-primary" />
            {formatNumber(value)}
        </div>
    );
}

function UserMetricCard({
    icon: Icon,
    label,
    tone,
    value,
}: {
    icon: LucideIcon;
    label: string;
    tone: Metric['tone'];
    value: string;
}) {
    return (
        <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-4 text-3xl font-semibold">{value}</p>
                </div>
                <span className={`rounded-md p-2 ring-1 ${toneClasses[tone]}`}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
        </div>
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
