import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    Bot,
    ChevronDown,
    Clock3,
    Download,
    DollarSign,
    FileText,
    LayoutDashboard,
    MessageSquare,
    Pencil,
    Plus,
    Printer,
    ShieldCheck,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { AdminConversationChart } from '@/components/admin-conversation-chart';
import { AdminFeedbackBarChart } from '@/components/admin-feedback-bar-chart';
import { AdminTokenUsageChart } from '@/components/admin-token-usage-chart';
import DekaLogo from '@/components/deka-logo';
import InputError from '@/components/input-error';
import SettingsModal from '@/components/settings-modal';
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
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    id: number;
    name: string;
    email: string;
    role: string;
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

type FeedbackReviewItem = {
    id: number;
    user: string;
    email: string;
    conversation: string;
    answer: string;
    reason: string;
    status: 'open' | 'reviewing' | 'resolved';
    createdAt: string;
};

type RoleItem = {
    id: number;
    slug: string;
    name: string;
    description: string;
    permissions: string[];
    usersCount: number;
    system: boolean;
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
    | 'roles'
    | 'feedback-review'
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
    feedbackReviewItems?: FeedbackReviewItem[];
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

type AdminUserFormData = {
    name: string;
    email: string;
    role: string;
    password: string;
    password_confirmation: string;
};

type AdminRoleFormData = {
    name: string;
    description: string;
};

const emptyAdminUserForm: AdminUserFormData = {
    name: '',
    email: '',
    role: 'user',
    password: '',
    password_confirmation: '',
};

const emptyAdminRoleForm: AdminRoleFormData = {
    name: '',
    description: '',
};

const defaultRoleItems: RoleItem[] = [
    {
        id: 1,
        slug: 'admin',
        name: 'Admin',
        description: 'Akses penuh untuk mengatur dasbor dan pengguna.',
        permissions: [
            'Dashboard',
            'Analytic',
            'Kelola pengguna',
            'Log aktivitas',
        ],
        usersCount: 0,
        system: true,
    },
    {
        id: 2,
        slug: 'user',
        name: 'Pengguna',
        description: 'Akses percakapan chatbot dan riwayat milik akun sendiri.',
        permissions: ['Chatbot', 'Riwayat chat', 'Profil akun'],
        usersCount: 0,
        system: true,
    },
];

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
        id: 1,
        name: 'Admin Deka',
        email: 'admin@deka.dev',
        role: 'admin',
        status: 'active',
        joinedAt: '13 Jul 2026',
        lastSeen: 'Baru saja',
        conversations: 11,
    },
    {
        id: 2,
        name: 'Nadia Putri',
        email: 'nadia@example.com',
        role: 'user',
        status: 'active',
        joinedAt: '14 Jul 2026',
        lastSeen: '2 menit lalu',
        conversations: 42,
    },
    {
        id: 3,
        name: 'Raka Firmansyah',
        email: 'raka@example.com',
        role: 'user',
        status: 'active',
        joinedAt: '15 Jul 2026',
        lastSeen: '8 menit lalu',
        conversations: 36,
    },
    {
        id: 4,
        name: 'Ayu Lestari',
        email: 'ayu@example.com',
        role: 'user',
        status: 'active',
        joinedAt: '16 Jul 2026',
        lastSeen: '21 menit lalu',
        conversations: 28,
    },
    {
        id: 5,
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
        action: 'Melihat pemakaian token',
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
const tokenInputPricePerMillion = 0.15;
const tokenOutputPricePerMillion = 0.6;
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
        description: 'Pengguna aktif dari data contoh saat ini.',
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
        label: 'Analytic',
        description: 'Pemakaian token AI per pengguna',
        icon: Sparkles,
    },
    {
        id: 'feedback-review',
        label: 'Review Feedback',
        description: 'Alasan dislike dan jawaban yang perlu ditinjau',
        icon: ThumbsDown,
    },
    {
        id: 'users',
        label: 'Kelola Pengguna',
        description: 'Admin, pengguna, dan masuk',
        icon: Users,
    },
    {
        id: 'roles',
        label: 'Kelola Roles',
        description: 'Tambah role tampilan admin',
        icon: ShieldCheck,
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

function openActivityLogReport(period: ReportPeriod, search?: string) {
    const params = new URLSearchParams({ period });
    const normalizedSearch = search?.trim();

    if (normalizedSearch) {
        params.set('search', normalizedSearch);
    }

    window.open(`/admin/activity-log/report?${params.toString()}`, '_blank');
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
        feedbackReviewItems = [],
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
    const [localFeedbackReviewItems, setLocalFeedbackReviewItems] =
        useState(feedbackReviewItems);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
    const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(
        null,
    );
    const userForm = useForm<AdminUserFormData>(emptyAdminUserForm);
    const [roleForm, setRoleForm] =
        useState<AdminRoleFormData>(emptyAdminRoleForm);
    const [localRoleItems, setLocalRoleItems] =
        useState<RoleItem[]>(defaultRoleItems);
    const [activityLiveStatus, setActivityLiveStatus] = useState<
        'live' | 'updating' | 'error'
    >('live');
    const activeSection = isSectionId(section) ? section : 'overview';
    const totalTokenUsage =
        totals?.totalTokenUsage ??
        tokenUsageItems.reduce((total, item) => total + item.totalTokens, 0);
    const totalPromptTokens = tokenUsageItems.reduce(
        (total, item) => total + item.promptTokens,
        0,
    );
    const totalCompletionTokens = tokenUsageItems.reduce(
        (total, item) => total + item.completionTokens,
        0,
    );
    const totalAiRequests = tokenUsageItems.reduce(
        (total, item) => total + item.requests,
        0,
    );
    const estimatedInputCost =
        (totalPromptTokens / 1_000_000) * tokenInputPricePerMillion;
    const estimatedOutputCost =
        (totalCompletionTokens / 1_000_000) * tokenOutputPricePerMillion;
    const estimatedTokenCost = estimatedInputCost + estimatedOutputCost;
    const averageTokensPerRequest = Math.round(
        totalTokenUsage / Math.max(totalAiRequests, 1),
    );
    const topTokenUser =
        tokenUsageItems.reduce<TokenUsageItem | null>(
            (topUser, item) =>
                !topUser || item.totalTokens > topUser.totalTokens
                    ? item
                    : topUser,
            null,
        ) ?? null;
    const promptTokenShare = Math.round(
        (totalPromptTokens / Math.max(totalTokenUsage, 1)) * 100,
    );
    const completionTokenShare = Math.round(
        (totalCompletionTokens / Math.max(totalTokenUsage, 1)) * 100,
    );
    const activeUsers =
        totals?.activeUsers ??
        adminUsers.filter((item) => item.status === 'active').length;
    const adminUserCount =
        totals?.adminUserCount ??
        adminUsers.filter((item) => item.role === 'admin').length;
    const totalUserConversations =
        totals?.totalUserConversations ??
        adminUsers.reduce((total, item) => total + item.conversations, 0);
    const roleItems = localRoleItems.map((role) => ({
        ...role,
        usersCount: adminUsers.filter((user) => user.role === role.slug).length,
    }));
    const defaultUserRole =
        roleItems.find((item) => item.slug === 'user')?.slug ??
        roleItems[0]?.slug ??
        'user';
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
    const openFeedbackReviews = localFeedbackReviewItems.filter(
        (item) => item.status === 'open',
    ).length;
    const activeFeedbackReviews = localFeedbackReviewItems.filter(
        (item) => item.status !== 'resolved',
    ).length;
    const resolvedFeedbackReviews = localFeedbackReviewItems.filter(
        (item) => item.status === 'resolved',
    ).length;
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
        setLocalFeedbackReviewItems(feedbackReviewItems);
    }, [feedbackReviewItems]);

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

    const openCreateUserDialog = () => {
        setSelectedUser(null);
        userForm.clearErrors();
        userForm.setData({ ...emptyAdminUserForm, role: defaultUserRole });
        setUserDialogOpen(true);
    };

    const openEditUserDialog = (user: AdminUserItem) => {
        setSelectedUser(user);
        userForm.clearErrors();
        userForm.setData({
            name: user.name,
            email: user.email,
            role: user.role,
            password: '',
            password_confirmation: '',
        });
        setUserDialogOpen(true);
    };

    const closeUserDialog = () => {
        setUserDialogOpen(false);
        setSelectedUser(null);
        userForm.clearErrors();
        userForm.setData({ ...emptyAdminUserForm, role: defaultUserRole });
    };

    const handleUserSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: closeUserDialog,
        };

        if (selectedUser) {
            userForm.put(`/admin/users/${selectedUser.id}`, options);

            return;
        }

        userForm.post('/admin/users', options);
    };

    const handleDeleteUser = (user: AdminUserItem) => {
        if (
            user.id === auth.user.id ||
            (user.role === 'admin' && adminUserCount <= 1)
        ) {
            return;
        }

        if (!window.confirm(`Hapus pengguna ${user.email}?`)) {
            return;
        }

        router.delete(`/admin/users/${user.id}`, {
            preserveScroll: true,
        });
    };

    const handleRoleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const name = roleForm.name.trim();

        if (!name) {
            return;
        }

        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        if (
            !slug ||
            localRoleItems.some(
                (role) => role.slug === slug && role.id !== selectedRole?.id,
            )
        ) {
            return;
        }

        if (selectedRole) {
            setLocalRoleItems((items) =>
                items.map((role) =>
                    role.id === selectedRole.id
                        ? {
                              ...role,
                              slug: role.system ? role.slug : slug,
                              name,
                              description:
                                  roleForm.description.trim() ||
                                  'Role pengguna kustom.',
                          }
                        : role,
                ),
            );
        } else {
            setLocalRoleItems((items) => [
                ...items,
                {
                    id: Date.now(),
                    slug,
                    name,
                    description:
                        roleForm.description.trim() || 'Role pengguna kustom.',
                    permissions: ['Chatbot'],
                    usersCount: 0,
                    system: false,
                },
            ]);
        }

        setRoleForm(emptyAdminRoleForm);
        setSelectedRole(null);
        setRoleDialogOpen(false);
    };

    const handleDeleteRole = (role: RoleItem) => {
        if (role.system || role.usersCount > 0) {
            return;
        }

        if (!window.confirm(`Hapus role ${role.name}?`)) {
            return;
        }

        setLocalRoleItems((items) =>
            items.filter((item) => item.id !== role.id),
        );
    };

    const openEditRoleDialog = (role: RoleItem) => {
        setSelectedRole(role);
        setRoleForm({
            name: role.name,
            description: role.description,
        });
        setRoleDialogOpen(true);
    };

    const closeRoleDialog = () => {
        setRoleDialogOpen(false);
        setSelectedRole(null);
        setRoleForm(emptyAdminRoleForm);
    };

    const updateFeedbackReviewStatus = (
        id: number,
        status: FeedbackReviewItem['status'],
    ) => {
        setLocalFeedbackReviewItems((items) =>
            items.map((item) => (item.id === id ? { ...item, status } : item)),
        );

        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        if (!csrfToken) {
            return;
        }

        void fetch(`/admin/feedback-review/${id}/status`, {
            method: 'PATCH',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
            },
            body: JSON.stringify({ status }),
        }).catch((error) => {
            console.error('Failed to update feedback review status:', error);
        });
    };

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
                                        setSettingsOpen(true)
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
                            <section className="flex min-h-0 flex-1 flex-col gap-6">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    <UserMetricCard
                                        icon={Sparkles}
                                        label="Total token"
                                        tone="blue"
                                        value={formatNumber(totalTokenUsage)}
                                    />
                                    <UserMetricCard
                                        icon={DollarSign}
                                        label="Estimasi biaya"
                                        tone="green"
                                        value={formatUsd(estimatedTokenCost)}
                                    />
                                    <UserMetricCard
                                        icon={BarChart3}
                                        label="Total request"
                                        tone="neutral"
                                        value={formatNumber(totalAiRequests)}
                                    />
                                    <UserMetricCard
                                        icon={MessageSquare}
                                        label="Rata-rata / request"
                                        tone="amber"
                                        value={formatNumber(
                                            averageTokensPerRequest,
                                        )}
                                    />
                                </div>

                                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                                    <div className="grid gap-6">
                                        <Card className="rounded-lg">
                                            <CardHeader className="gap-3 pb-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <CardTitle>
                                                            Usage token per user
                                                        </CardTitle>
                                                        <CardDescription>
                                                            Ringkasan token AI
                                                            yang dipakai tiap
                                                            pengguna. Input
                                                            adalah token dari
                                                            pertanyaan dan
                                                            konteks, output
                                                            adalah token jawaban
                                                            AI.
                                                        </CardDescription>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="w-fit"
                                                    >
                                                        {formatNumber(
                                                            totalTokenUsage,
                                                        )}{' '}
                                                        total token
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex flex-1 flex-col gap-4">
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <TokenInsightCard
                                                        label="Pengguna tertinggi"
                                                        value={
                                                            topTokenUser
                                                                ? topTokenUser.user
                                                                : '-'
                                                        }
                                                        detail={
                                                            topTokenUser
                                                                ? `${formatNumber(topTokenUser.totalTokens)} token`
                                                                : 'Belum ada data'
                                                        }
                                                    />
                                                    <TokenInsightCard
                                                        label="Porsi input"
                                                        value={`${promptTokenShare}%`}
                                                        detail={`${formatNumber(totalPromptTokens)} token pertanyaan`}
                                                    />
                                                    <TokenInsightCard
                                                        label="Porsi output"
                                                        value={`${completionTokenShare}%`}
                                                        detail={`${formatNumber(totalCompletionTokens)} token jawaban`}
                                                    />
                                                </div>
                                                <div className="overflow-hidden rounded-md border">
                                                    <div className="min-w-0">
                                                        <div className="grid grid-cols-[minmax(140px,1fr)_70px_96px_96px_106px] items-center gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                            <span>
                                                                Pengguna
                                                            </span>
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
                                                        {tokenUsageItems.length >
                                                        0 ? (
                                                            tokenUsageItems.map(
                                                                (item) => (
                                                                    <div
                                                                        key={
                                                                            item.email
                                                                        }
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
                                    </div>

                                    <AdminTokenUsageChart
                                        data={tokenUsageItems}
                                        className="flex min-h-[520px] flex-col"
                                        chartClassName="h-full min-h-[260px] max-h-[320px] max-w-[320px]"
                                    />
                                </div>
                            </section>
                        )}

                        {activeSection === 'feedback-review' && (
                            <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    <UserMetricCard
                                        icon={ThumbsDown}
                                        label="Feedback aktif"
                                        tone="amber"
                                        value={formatNumber(
                                            activeFeedbackReviews,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={AlertTriangle}
                                        label="Belum ditinjau"
                                        tone="blue"
                                        value={formatNumber(
                                            openFeedbackReviews,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={ShieldCheck}
                                        label="Selesai"
                                        tone="green"
                                        value={formatNumber(
                                            resolvedFeedbackReviews,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={MessageSquare}
                                        label="Total dislike"
                                        tone="neutral"
                                        value={formatNumber(
                                            totals?.totalDislikes ??
                                                totalDislikes,
                                        )}
                                    />
                                </div>

                                <Card className="flex min-h-0 flex-col rounded-lg">
                                    <CardHeader className="gap-3">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Review alasan dislike
                                                </CardTitle>
                                                <CardDescription>
                                                    Daftar jawaban AI yang
                                                    mendapat dislike beserta
                                                    alasan dari user.
                                                </CardDescription>
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className="w-fit"
                                            >
                                                {formatNumber(
                                                    localFeedbackReviewItems.length,
                                                )}{' '}
                                                feedback masuk
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-x-auto rounded-md border">
                                            <div className="min-w-[920px]">
                                                <div className="grid grid-cols-[minmax(190px,0.9fr)_minmax(230px,1fr)_minmax(260px,1.2fr)_140px_120px_170px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                    <span>User</span>
                                                    <span>Alasan</span>
                                                    <span>
                                                        Ringkasan jawaban
                                                    </span>
                                                    <span>Status</span>
                                                    <span>Waktu</span>
                                                    <span className="text-right">
                                                        Aksi
                                                    </span>
                                                </div>

                                                {localFeedbackReviewItems.length >
                                                0 ? (
                                                    localFeedbackReviewItems.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                className="grid grid-cols-[minmax(190px,0.9fr)_minmax(230px,1fr)_minmax(260px,1.2fr)_140px_120px_170px] gap-3 border-b px-4 py-4 last:border-b-0"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-medium">
                                                                        {
                                                                            item.user
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                        {
                                                                            item.email
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-medium">
                                                                        {
                                                                            item.reason
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                        {
                                                                            item.conversation
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                                                                    {
                                                                        item.answer
                                                                    }
                                                                </p>
                                                                <div>
                                                                    <FeedbackReviewStatusBadge
                                                                        status={
                                                                            item.status
                                                                        }
                                                                    />
                                                                </div>
                                                                <p className="text-sm whitespace-nowrap text-muted-foreground">
                                                                    {
                                                                        item.createdAt
                                                                    }
                                                                </p>
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={
                                                                            item.status ===
                                                                            'reviewing'
                                                                        }
                                                                        onClick={() =>
                                                                            updateFeedbackReviewStatus(
                                                                                item.id,
                                                                                'reviewing',
                                                                            )
                                                                        }
                                                                    >
                                                                        Proses
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        disabled={
                                                                            item.status ===
                                                                            'resolved'
                                                                        }
                                                                        onClick={() =>
                                                                            updateFeedbackReviewStatus(
                                                                                item.id,
                                                                                'resolved',
                                                                            )
                                                                        }
                                                                    >
                                                                        Selesai
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <EmptyTableRow text="Belum ada alasan dislike yang masuk." />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
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

                        {activeSection === 'roles' && (
                            <section className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6">
                                <div className="grid shrink-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                                    <UserMetricCard
                                        icon={ShieldCheck}
                                        label="Total roles"
                                        tone="blue"
                                        value={formatNumber(roleItems.length)}
                                    />
                                    <UserMetricCard
                                        icon={ShieldCheck}
                                        label="Role bawaan"
                                        tone="neutral"
                                        value={formatNumber(
                                            roleItems.filter(
                                                (item) => item.system,
                                            ).length,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={Users}
                                        label="Role kustom"
                                        tone="green"
                                        value={formatNumber(
                                            roleItems.filter(
                                                (item) => !item.system,
                                            ).length,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={Users}
                                        label="Role terpakai"
                                        tone="amber"
                                        value={formatNumber(
                                            roleItems.filter(
                                                (item) => item.usersCount > 0,
                                            ).length,
                                        )}
                                    />
                                </div>

                                <Card className="flex min-h-0 flex-col rounded-lg">
                                    <CardHeader className="gap-3">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Daftar Roles
                                                </CardTitle>
                                                <CardDescription>
                                                    Role yang tersedia untuk
                                                    pilihan pengguna di
                                                    dashboard.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedRole(null);
                                                    setRoleForm(
                                                        emptyAdminRoleForm,
                                                    );
                                                    setRoleDialogOpen(true);
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Tambah Role
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-hidden rounded-md border">
                                            <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[minmax(260px,1fr)_120px_120px_minmax(220px,1fr)_120px]">
                                                <span>Role</span>
                                                <span className="hidden md:block">
                                                    Tipe
                                                </span>
                                                <span className="hidden md:block">
                                                    Akun
                                                </span>
                                                <span className="hidden md:block">
                                                    Akses
                                                </span>
                                                <span className="text-right">
                                                    Aksi
                                                </span>
                                            </div>

                                            {roleItems.map((item) => {
                                                const canDelete =
                                                    !item.system &&
                                                    item.usersCount === 0;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(260px,1fr)_120px_120px_minmax(220px,1fr)_120px]"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="truncate text-sm font-medium">
                                                                    {item.name}
                                                                </p>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] md:hidden"
                                                                >
                                                                    {item.system
                                                                        ? 'Bawaan'
                                                                        : 'Kustom'}
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                {
                                                                    item.description
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="hidden md:block">
                                                            <Badge variant="outline">
                                                                {item.system
                                                                    ? 'Bawaan'
                                                                    : 'Kustom'}
                                                            </Badge>
                                                        </div>
                                                        <p className="hidden text-sm text-muted-foreground tabular-nums md:block">
                                                            {formatNumber(
                                                                item.usersCount,
                                                            )}
                                                        </p>
                                                        <div className="hidden min-w-0 flex-wrap gap-2 md:flex">
                                                            {item.permissions.map(
                                                                (
                                                                    permission,
                                                                ) => (
                                                                    <Badge
                                                                        key={
                                                                            permission
                                                                        }
                                                                        variant="secondary"
                                                                        className="font-normal"
                                                                    >
                                                                        {
                                                                            permission
                                                                        }
                                                                    </Badge>
                                                                ),
                                                            )}
                                                        </div>
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Edit role"
                                                                onClick={() =>
                                                                    openEditRoleDialog(
                                                                        item,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Hapus role"
                                                                disabled={
                                                                    !canDelete
                                                                }
                                                                onClick={() =>
                                                                    handleDeleteRole(
                                                                        item,
                                                                    )
                                                                }
                                                                className="text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                                    <CardHeader className="gap-3">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Daftar Pengguna
                                                </CardTitle>
                                                <CardDescription>
                                                    User yang terdaftar di
                                                    chatbot Deka.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={openCreateUserDialog}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Tambah Pengguna
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-hidden rounded-md border">
                                            <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[minmax(260px,1fr)_120px_120px_120px_140px_120px]">
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
                                                <span className="hidden md:block">
                                                    Aktif
                                                </span>
                                                <span className="text-right">
                                                    Aksi
                                                </span>
                                            </div>

                                            {adminUsers.length > 0 ? (
                                                adminUsers.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(260px,1fr)_120px_120px_120px_140px_120px]"
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
                                                        <p className="hidden text-sm whitespace-nowrap text-muted-foreground md:block">
                                                            {item.lastSeen}
                                                        </p>
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Edit pengguna"
                                                                onClick={() =>
                                                                    openEditUserDialog(
                                                                        item,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Hapus pengguna"
                                                                disabled={
                                                                    item.id ===
                                                                        auth
                                                                            .user
                                                                            .id ||
                                                                    (item.role ===
                                                                        'admin' &&
                                                                        adminUserCount <=
                                                                            1)
                                                                }
                                                                onClick={() =>
                                                                    handleDeleteUser(
                                                                        item,
                                                                    )
                                                                }
                                                                className="text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
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
                                            <div className="flex flex-wrap items-center gap-2">
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
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button size="sm">
                                                            <FileText className="h-4 w-4" />
                                                            Laporan
                                                            <ChevronDown className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-56"
                                                    >
                                                        <DropdownMenuLabel>
                                                            Periode
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                updateActivityPeriod(
                                                                    'week',
                                                                    filters?.search,
                                                                )
                                                            }
                                                        >
                                                            <Clock3 className="h-4 w-4" />
                                                            Mingguan
                                                            {activityPeriod ===
                                                                'week' && (
                                                                <span className="ml-auto text-xs text-muted-foreground">
                                                                    Aktif
                                                                </span>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                updateActivityPeriod(
                                                                    'month',
                                                                    filters?.search,
                                                                )
                                                            }
                                                        >
                                                            <Clock3 className="h-4 w-4" />
                                                            Bulanan
                                                            {activityPeriod ===
                                                                'month' && (
                                                                <span className="ml-auto text-xs text-muted-foreground">
                                                                    Aktif
                                                                </span>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                updateActivityPeriod(
                                                                    'year',
                                                                    filters?.search,
                                                                )
                                                            }
                                                        >
                                                            <Clock3 className="h-4 w-4" />
                                                            Tahunan
                                                            {activityPeriod ===
                                                                'year' && (
                                                                <span className="ml-auto text-xs text-muted-foreground">
                                                                    Aktif
                                                                </span>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuLabel>
                                                            Export
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                exportAdminActivityReport(
                                                                    activityPeriod,
                                                                    liveActivityItems,
                                                                )
                                                            }
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            Excel
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                openActivityLogReport(
                                                                    activityPeriod,
                                                                    filters?.search,
                                                                )
                                                            }
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                            PDF
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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
            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
            {roleDialogOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1.5px]">
                    <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold">
                                {selectedRole ? 'Edit Role' : 'Tambah Role'}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Role tampil di daftar role dan pilihan role
                                pengguna.
                            </p>
                        </div>

                        <form onSubmit={handleRoleSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="admin-role-name">
                                    Nama Role
                                </Label>
                                <Input
                                    id="admin-role-name"
                                    value={roleForm.name}
                                    onChange={(event) =>
                                        setRoleForm((form) => ({
                                            ...form,
                                            name: event.target.value,
                                        }))
                                    }
                                    required
                                    placeholder="Contoh: Supervisor"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-role-description">
                                    Deskripsi
                                </Label>
                                <Input
                                    id="admin-role-description"
                                    value={roleForm.description}
                                    onChange={(event) =>
                                        setRoleForm((form) => ({
                                            ...form,
                                            description: event.target.value,
                                        }))
                                    }
                                    placeholder="Keterangan singkat role"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeRoleDialog}
                                >
                                    Batal
                                </Button>
                                <Button type="submit">
                                    <Plus className="h-4 w-4" />
                                    {selectedRole
                                        ? 'Simpan Role'
                                        : 'Tambah Role'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {userDialogOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1.5px]">
                    <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold">
                                {selectedUser
                                    ? 'Edit Pengguna'
                                    : 'Tambah Pengguna'}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Kelola nama, email, role, dan password akun.
                            </p>
                        </div>

                        <form onSubmit={handleUserSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="admin-user-name">Nama</Label>
                                <Input
                                    id="admin-user-name"
                                    value={userForm.data.name}
                                    onChange={(event) =>
                                        userForm.setData(
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                    required
                                    autoComplete="name"
                                    placeholder="Nama pengguna"
                                />
                                <InputError message={userForm.errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-user-email">Email</Label>
                                <Input
                                    id="admin-user-email"
                                    type="email"
                                    value={userForm.data.email}
                                    onChange={(event) =>
                                        userForm.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    required
                                    autoComplete="email"
                                    placeholder="nama@email.com"
                                />
                                <InputError message={userForm.errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-user-role">Role</Label>
                                <select
                                    id="admin-user-role"
                                    value={userForm.data.role}
                                    onChange={(event) =>
                                        userForm.setData(
                                            'role',
                                            event.target.value,
                                        )
                                    }
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    {roleItems.map((role) => (
                                        <option
                                            key={role.slug}
                                            value={role.slug}
                                        >
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={userForm.errors.role} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-user-password">
                                    Password
                                </Label>
                                <Input
                                    id="admin-user-password"
                                    type="password"
                                    value={userForm.data.password}
                                    onChange={(event) =>
                                        userForm.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    required={!selectedUser}
                                    autoComplete="new-password"
                                    placeholder={
                                        selectedUser
                                            ? 'Kosongkan jika tidak diubah'
                                            : 'Minimal 8 karakter'
                                    }
                                />
                                <InputError
                                    message={userForm.errors.password}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-user-password-confirmation">
                                    Konfirmasi Password
                                </Label>
                                <Input
                                    id="admin-user-password-confirmation"
                                    type="password"
                                    value={userForm.data.password_confirmation}
                                    onChange={(event) =>
                                        userForm.setData(
                                            'password_confirmation',
                                            event.target.value,
                                        )
                                    }
                                    required={!selectedUser}
                                    autoComplete="new-password"
                                    placeholder="Ulangi password"
                                />
                            </div>

                            <InputError
                                message={
                                    (userForm.errors as Record<string, string>)
                                        .user
                                }
                            />

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeUserDialog}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={userForm.processing}
                                >
                                    {selectedUser ? 'Simpan' : 'Tambah'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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

function escapeHtml(value: string | number | null | undefined) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function exportAdminActivityReport(
    period: ReportPeriod,
    items: AdminActivityItem[],
) {
    const periodLabel = reportPeriodLabel(period);
    const rowCount = Math.max(items.length, 25);
    const rows = Array.from({ length: rowCount }, (_, index) => {
        const item = items[index];

        if (!item) {
            return `
   <Row ss:Height="22">
    <Cell ss:StyleID="cellCenter"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="cellCenter"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="cellLeft"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="cellLeft"><Data ss:Type="String"></Data></Cell>
   </Row>`;
        }

        const activityText = `${escapeHtml(item.action)}${item.target ? ` - ${escapeHtml(item.target)}` : ''}`;
        const commentsText = `${escapeHtml(item.detail)} | ${escapeHtml(activityCategoryLabel(item.category))} | ${escapeHtml(item.admin)} | IP: ${escapeHtml(item.ipAddress)}`;

        return `
   <Row ss:Height="26">
    <Cell ss:StyleID="cellCenter"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="cellCenter"><Data ss:Type="String">${escapeHtml(item.time)}</Data></Cell>
    <Cell ss:StyleID="cellLeft"><Data ss:Type="String">${activityText}</Data></Cell>
    <Cell ss:StyleID="cellLeft"><Data ss:Type="String">${commentsText}</Data></Cell>
   </Row>`;
    }).join('');

    const excel = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Deka Chatbot</Author>
  <LastAuthor>Deka Chatbot</LastAuthor>
  <Created>${new Date().toISOString()}</Created>
  <Version>16.00</Version>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="title">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="16" ss:Bold="1" ss:Color="#2F80ED" ss:Underline="Single"/>
  </Style>
  <Style ss:ID="header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#155FC4"/>
   <Interior ss:Color="#E8F2FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="cellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#102033"/>
  </Style>
  <Style ss:ID="cellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B2C5DC"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#102033"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Log Aktivitas Admin">
  <Table ss:ExpandedColumnCount="4" ss:ExpandedRowCount="${rowCount + 3}" x:FullColumns="1"
   x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="120"/>
   <Column ss:Width="380"/>
   <Column ss:Width="260"/>
   <Row ss:Height="40">
    <Cell ss:MergeAcross="3" ss:StyleID="title"><Data ss:Type="String">LOG AKTIVITAS ADMIN</Data></Cell>
   </Row>
   <Row ss:Height="15"/>
   <Row ss:Height="26">
    <Cell ss:StyleID="header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Activities / Tasks / Items</Data></Cell>
    <Cell ss:StyleID="header"><Data ss:Type="String">Comments</Data></Cell>
   </Row>
   ${rows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
    <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
   </PageSetup>
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([excel], {
        type: 'application/vnd.ms-excel;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `laporan-aktivitas-admin-${period}.xls`;
    link.click();
    URL.revokeObjectURL(url);

    console.info(`Laporan aktivitas admin ${periodLabel} diexport ke Excel.`);
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

function TokenInsightCard({
    detail,
    label,
    value,
}: {
    detail: string;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-sm font-semibold">{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
                {detail}
            </p>
        </div>
    );
}

function FeedbackReviewStatusBadge({
    status,
}: {
    status: FeedbackReviewItem['status'];
}) {
    const labels: Record<FeedbackReviewItem['status'], string> = {
        open: 'Open',
        reviewing: 'Diproses',
        resolved: 'Selesai',
    };
    const classes: Record<FeedbackReviewItem['status'], string> = {
        open: 'border-transparent bg-[#fff4df] text-[#b45309] dark:bg-[#3b2508] dark:text-[#f7c56b]',
        reviewing:
            'border-transparent bg-[#eaf3ff] text-[#2f80ed] dark:bg-[#102b4a] dark:text-[#8fc1ff]',
        resolved:
            'border-transparent bg-[#e8f2ff] text-[#155fc4] dark:bg-[#12365f] dark:text-[#b8d9ff]',
    };

    return (
        <Badge variant="outline" className={classes[status]}>
            {labels[status]}
        </Badge>
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

function formatUsd(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: value >= 1 ? 2 : 4,
    }).format(value);
}
