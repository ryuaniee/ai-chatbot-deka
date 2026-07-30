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
import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { TokenTrendItem } from '@/components/admin-token-trend-chart';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import type { Auth } from '@/types';

const AdminConversationChart = lazy(() =>
    import('@/components/admin-conversation-chart').then((module) => ({
        default: module.AdminConversationChart,
    })),
);
const AdminFeedbackBarChart = lazy(() =>
    import('@/components/admin-feedback-bar-chart').then((module) => ({
        default: module.AdminFeedbackBarChart,
    })),
);
const AdminTokenTrendChart = lazy(() =>
    import('@/components/admin-token-trend-chart').then((module) => ({
        default: module.AdminTokenTrendChart,
    })),
);
const AdminTokenUsageChart = lazy(() =>
    import('@/components/admin-token-usage-chart').then((module) => ({
        default: module.AdminTokenUsageChart,
    })),
);

type Metric = {
    label: string;
    value: string;
    description: string;
    tone: 'green' | 'blue' | 'amber' | 'neutral';
    icon: keyof typeof metricIcons;
};

type KnowledgeItem = {
    title: string;
    source: string;
    chunks: number;
    status: string;
    version?: number | null;
    activeVersion?: number | null;
    changedChunks?: number;
    probesPassed?: number;
    probesTotal?: number;
    validationError?: string | null;
};

type KnowledgeStats = {
    answerGrounding: number;
    retrievalReady: number;
    sourceTraceability: number;
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

type TokenUsageTrend = {
    currentTokens: number;
    previousTokens: number;
    changePercent: number | null;
    direction: 'up' | 'down' | 'flat' | 'neutral';
};

type AdminUserItem = {
    id: number;
    name: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
    emailVerified: boolean;
    emailVerifiedAt?: string | null;
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
    question: string;
    answer: string;
    reason: string;
    status: 'open' | 'reviewing' | 'resolved' | 'ignored';
    adminDecision?: 'solve' | 'ignore' | null;
    adminNote?: string | null;
    aiImprovement?: string | null;
    createdAt: string;
};

type FeedbackStatusFilter =
    'all' | 'open' | 'reviewing' | 'resolved' | 'ignored';

type UserRoleFilter = 'all' | 'admin' | 'user';

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
};

type SectionId =
    | 'overview'
    | 'users'
    | 'roles'
    | 'feedback-review'
    | 'activity-log'
    | 'analytic'
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
    tokenUsageItems?: TokenUsageItem[];
    tokenUsageSummaryItems?: TokenUsageItem[];
    analyticTokenUsageItems?: TokenUsageItem[];
    analyticTokenUsagePagination?: TokenUsagePagination;
    tokenUsageTrend?: TokenUsageTrend;
    tokenTrendItems?: TokenTrendItem[];
    roleItems?: RoleItem[];
    adminUsers?: AdminUserItem[];
    adminActivityItems?: AdminActivityItem[];
    adminActivityPagination?: ActivityLogPagination;
    feedbackReviewItems?: FeedbackReviewItem[];
    feedbackReviewPagination?: FeedbackReviewPagination;
    knowledgeItems?: KnowledgeItem[];
    knowledgeStats?: KnowledgeStats;
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
        page?: number;
        feedbackSearch?: string;
        feedbackStatus?: FeedbackStatusFilter;
        feedbackPage?: number;
        tokenSearch?: string;
        tokenPage?: number;
    };
};

type ActivityLogTotals = Pick<
    NonNullable<AdminPageProps['totals']>,
    'activityToday' | 'conversationActions' | 'reportExports'
>;

type ActivityLogPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
    from: number | null;
    to: number | null;
    hasMorePages: boolean;
};

type ActivityLogLivePayload = {
    adminActivityItems: AdminActivityItem[];
    pagination: ActivityLogPagination;
    filters: {
        period: ReportPeriod;
        search: string;
        page: number;
    };
    totals: ActivityLogTotals;
};

type FeedbackReviewPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
    from: number | null;
    to: number | null;
    hasMorePages: boolean;
};

type TokenUsagePagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
    from: number | null;
    to: number | null;
    hasMorePages: boolean;
};

type AdminUserFormData = {
    name: string;
    email: string;
    role: string;
    email_verified: boolean;
    password: string;
    password_confirmation: string;
};

type RoleFormData = {
    slug: string;
    name: string;
    description: string;
    permissions: string[];
};

const emptyAdminUserForm: AdminUserFormData = {
    name: '',
    email: '',
    role: 'user',
    email_verified: true,
    password: '',
    password_confirmation: '',
};

const emptyRoleForm: RoleFormData = {
    slug: '',
    name: '',
    description: '',
    permissions: [],
};

const metricIcons = {
    message: MessageSquare,
    sparkles: Sparkles,
    thumbsDown: ThumbsDown,
    thumbsUp: ThumbsUp,
    users: Users,
    book: BookOpen,
} satisfies Record<string, LucideIcon>;

const tokenInputPricePerMillion = 5;
const tokenOutputPricePerMillion = 30;

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
        id: 'analytic',
        label: 'Analitik',
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
        label: 'Kelola Role',
        description: 'Role sistem dan jumlah akun terkait',
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
    green: 'bg-[#e8f2ff] text-[#155fc4] ring-[#b9d8ff]   ',
    blue: 'bg-[#eaf3ff] text-[#2f80ed] ring-[#b9d8ff]   ',
    amber: 'bg-[#fff4df] text-[#b45309] ring-[#f5d08b]   ',
    neutral: 'bg-[#eef4fb] text-[#40566f] ring-[#d9e4f2]   ',
};

const activityCategoryClasses: Record<AdminActivityItem['category'], string> = {
    auth: 'border-transparent bg-[#eef2ff] text-[#4338ca]  ',
    conversation: 'border-transparent bg-[#e0f2fe] text-[#0369a1]  ',
    user: 'border-transparent bg-[#eff6ff] text-[#1d4ed8]  ',
    report: 'border-transparent bg-[#fff7ed] text-[#c2410c]  ',
    system: 'border-transparent bg-[#ecfdf5] text-[#047857]  ',
};

const sectionHref = (sectionId: SectionId) => `/admin/${sectionId}`;

const isSectionId = (value: unknown): value is SectionId =>
    typeof value === 'string' && navigation.some((item) => item.id === value);

function ChartFallback({ className = '' }: { className?: string }) {
    return (
        <div
            className={`rounded-lg border border-slate-200 bg-white p-6 shadow-sm ${className}`}
        >
            <div className="flex items-center justify-between">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="mt-8 grid h-40 grid-cols-5 items-end gap-3">
                {[36, 52, 44, 72, 58].map((height, index) => (
                    <div
                        key={index}
                        className="rounded-t-lg bg-slate-100"
                        style={{ height: `${height}%` }}
                    />
                ))}
            </div>
        </div>
    );
}

function formatImprovementNote(note: string): {
    paragraphs: string[];
    bullets: string[];
} {
    const normalized = note
        .replace(/\r/g, '')
        .replace(/\*\*/g, '')
        .replace(/\s+[•*]\s+/g, '\n- ')
        .replace(/^[•*]\s+/gm, '- ')
        .replace(/\n{2,}/g, '\n')
        .trim();

    return normalized.split('\n').reduce<{
        paragraphs: string[];
        bullets: string[];
    }>(
        (accumulator, line) => {
            const value = line.trim();

            if (value === '') {
                return accumulator;
            }

            if (value.startsWith('- ')) {
                accumulator.bullets.push(value.slice(2).trim());

                return accumulator;
            }

            accumulator.paragraphs.push(value);

            return accumulator;
        },
        { paragraphs: [], bullets: [] },
    );
}

function updateActivityPeriod(period: ReportPeriod, search?: string) {
    const normalizedSearch = search?.trim();

    router.get(
        sectionHref('activity-log'),
        {
            period,
            page: 1,
            ...(normalizedSearch ? { search: normalizedSearch } : {}),
        },
        { preserveState: false },
    );
}

function updateActivityPage(
    page: number,
    period: ReportPeriod,
    search?: string,
) {
    const normalizedSearch = search?.trim();

    router.get(
        sectionHref('activity-log'),
        {
            period,
            page,
            ...(normalizedSearch ? { search: normalizedSearch } : {}),
        },
        { preserveState: false, preserveScroll: true },
    );
}

function updateFeedbackReviewFilters(options: {
    search?: string;
    status?: FeedbackStatusFilter;
    page?: number;
}) {
    const normalizedSearch = options.search?.trim();

    router.get(
        sectionHref('feedback-review'),
        {
            feedback_page: options.page ?? 1,
            ...(options.status && options.status !== 'all'
                ? { feedback_status: options.status }
                : {}),
            ...(normalizedSearch ? { feedback_search: normalizedSearch } : {}),
        },
        {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: [
                'section',
                'feedbackReviewItems',
                'feedbackReviewPagination',
                'filters',
                'totals',
            ],
        },
    );
}

function updateAnalyticFilters(options: { search?: string; page?: number }) {
    const normalizedSearch = options.search?.trim();

    router.get(
        sectionHref('analytic'),
        {
            token_page: options.page ?? 1,
            ...(normalizedSearch ? { token_search: normalizedSearch } : {}),
        },
        {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: [
                'section',
                'analyticTokenUsageItems',
                'analyticTokenUsagePagination',
                'filters',
                'totals',
            ],
        },
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
        tokenUsageItems = [],
        tokenUsageSummaryItems = [],
        analyticTokenUsageItems = [],
        analyticTokenUsagePagination = {
            currentPage: 1,
            lastPage: 1,
            perPage: 12,
            total: 0,
            from: null,
            to: null,
            hasMorePages: false,
        },
        tokenUsageTrend,
        tokenTrendItems = [],
        roleItems = [],
        adminUsers = [],
        adminActivityItems = [],
        adminActivityPagination = {
            currentPage: 1,
            lastPage: 1,
            perPage: 15,
            total: 0,
            from: null,
            to: null,
            hasMorePages: false,
        },
        feedbackReviewItems = [],
        feedbackReviewPagination = {
            currentPage: 1,
            lastPage: 1,
            perPage: 12,
            total: 0,
            from: null,
            to: null,
            hasMorePages: false,
        },
        knowledgeItems = [],
        knowledgeStats = {
            answerGrounding: 0,
            retrievalReady: 0,
            sourceTraceability: 0,
        },
        chatTrendItems = [],
        feedbackChartItems = [],
        totals,
        filters,
    } = usePage<AdminPageProps>().props;
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return (
            window.localStorage.getItem('admin-sidebar-collapsed') === 'true'
        );
    });
    const [liveActivityItems, setLiveActivityItems] =
        useState(adminActivityItems);
    const [liveActivityPagination, setLiveActivityPagination] = useState(
        adminActivityPagination,
    );
    const [liveFeedbackReviewPagination, setLiveFeedbackReviewPagination] =
        useState(feedbackReviewPagination);
    const [liveActivityTotals, setLiveActivityTotals] =
        useState<ActivityLogTotals | null>(null);
    const [localFeedbackReviewItems, setLocalFeedbackReviewItems] =
        useState(feedbackReviewItems);
    const [analyticSearchDraft, setAnalyticSearchDraft] = useState(
        filters?.tokenSearch ?? '',
    );
    const [pendingFeedbackAction, setPendingFeedbackAction] = useState<
        string | null
    >(null);
    const [selectedFeedbackReviewId, setSelectedFeedbackReviewId] = useState<
        number | null
    >(null);
    const [improvementDraft, setImprovementDraft] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(
        null,
    );
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
    const userForm = useForm<AdminUserFormData>(emptyAdminUserForm);
    const roleForm = useForm<RoleFormData>(emptyRoleForm);
    const [feedbackSearchDraft, setFeedbackSearchDraft] = useState(
        filters?.feedbackSearch ?? '',
    );
    const [usersSearchDraft, setUsersSearchDraft] = useState('');
    const [usersRoleFilter, setUsersRoleFilter] =
        useState<UserRoleFilter>('all');
    const [activityLiveStatus, setActivityLiveStatus] = useState<
        'live' | 'updating' | 'error'
    >('live');
    const activeSection = isSectionId(section) ? section : 'overview';
    const totalTokenUsage =
        totals?.totalTokenUsage ??
        tokenUsageSummaryItems.reduce(
            (total, item) => total + item.totalTokens,
            0,
        );
    const totalPromptTokens = tokenUsageSummaryItems.reduce(
        (total, item) => total + item.promptTokens,
        0,
    );
    const totalCompletionTokens = tokenUsageSummaryItems.reduce(
        (total, item) => total + item.completionTokens,
        0,
    );
    const totalAiRequests = tokenUsageSummaryItems.reduce(
        (total, item) => total + item.requests,
        0,
    );
    const estimatedInputCost =
        (totalPromptTokens / 1_000_000) * tokenInputPricePerMillion;
    const estimatedOutputCost =
        (totalCompletionTokens / 1_000_000) * tokenOutputPricePerMillion;
    const estimatedTokenCost = estimatedInputCost + estimatedOutputCost;
    const estimatedCostPerRequest =
        estimatedTokenCost / Math.max(totalAiRequests, 1);
    const averageTokensPerRequest = Math.round(
        totalTokenUsage / Math.max(totalAiRequests, 1),
    );
    const topTokenUser =
        tokenUsageSummaryItems.reduce<TokenUsageItem | null>(
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
    const tokenUsageTrendLabel = getTokenUsageTrendLabel(tokenUsageTrend);
    const activeUsers =
        totals?.activeUsers ??
        adminUsers.filter((item) => item.status === 'active').length;
    const adminUserCount =
        totals?.adminUserCount ??
        adminUsers.filter((item) => item.role === 'admin').length;
    const totalUserConversations =
        totals?.totalUserConversations ??
        adminUsers.reduce((total, item) => total + item.conversations, 0);
    const defaultUserRole =
        roleItems.find((item) => item.slug === 'user')?.slug ??
        roleItems[0]?.slug ??
        'user';
    const activityPeriod = filters?.period ?? 'month';
    const feedbackStatus = filters?.feedbackStatus ?? 'all';
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
        (item) => !['resolved', 'ignored'].includes(item.status),
    ).length;
    const resolvedFeedbackReviews = localFeedbackReviewItems.filter(
        (item) => item.status === 'resolved',
    ).length;
    const ignoredFeedbackReviews = localFeedbackReviewItems.filter(
        (item) => item.status === 'ignored',
    ).length;
    const feedbackReviewDisplayItems = localFeedbackReviewItems;
    const filteredAdminUsers = adminUsers.filter((item) => {
        const normalizedSearch = usersSearchDraft.trim().toLowerCase();
        const matchesSearch =
            normalizedSearch === '' ||
            item.name.toLowerCase().includes(normalizedSearch) ||
            item.email.toLowerCase().includes(normalizedSearch);
        const matchesRole =
            usersRoleFilter === 'all' || item.role === usersRoleFilter;

        return matchesSearch && matchesRole;
    });
    const selectedFeedbackReview =
        localFeedbackReviewItems.find(
            (item) => item.id === selectedFeedbackReviewId,
        ) ?? null;
    const profileInitials = auth.user.name
        .split(' ')
        .map((name) => name[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const activeNavigation = navigation.find(
        (item) => item.id === activeSection,
    );
    const sidebarNavigationGroups = [
        {
            label: 'Ringkasan',
            items: navigation.filter((item) =>
                ['overview', 'analytic', 'feedback-review'].includes(item.id),
            ),
        },
        {
            label: 'Manajemen',
            items: navigation.filter((item) =>
                ['users', 'roles', 'activity-log'].includes(item.id),
            ),
        },
    ];

    const [prevActivitySync, setPrevActivitySync] = useState<
        [typeof adminActivityItems, typeof adminActivityPagination] | null
    >(null);

    if (
        prevActivitySync === null ||
        prevActivitySync[0] !== adminActivityItems ||
        prevActivitySync[1] !== adminActivityPagination
    ) {
        setPrevActivitySync([adminActivityItems, adminActivityPagination]);
        setLiveActivityItems(adminActivityItems);
        setLiveActivityTotals(null);
        setLiveActivityPagination(adminActivityPagination);
    }

    const feedbackSearchFilter = filters?.feedbackSearch ?? '';
    const [prevFeedbackSync, setPrevFeedbackSync] = useState<
        | [typeof feedbackReviewItems, typeof feedbackReviewPagination, string]
        | null
    >(null);

    if (
        prevFeedbackSync === null ||
        prevFeedbackSync[0] !== feedbackReviewItems ||
        prevFeedbackSync[1] !== feedbackReviewPagination ||
        prevFeedbackSync[2] !== feedbackSearchFilter
    ) {
        setPrevFeedbackSync([
            feedbackReviewItems,
            feedbackReviewPagination,
            feedbackSearchFilter,
        ]);
        setLocalFeedbackReviewItems(feedbackReviewItems);
        setLiveFeedbackReviewPagination(feedbackReviewPagination);
        setFeedbackSearchDraft(feedbackSearchFilter);
    }

    const tokenSearchFilter = filters?.tokenSearch ?? '';
    const [prevTokenSearchFilter, setPrevTokenSearchFilter] = useState<
        string | null
    >(null);

    if (prevTokenSearchFilter !== tokenSearchFilter) {
        setPrevTokenSearchFilter(tokenSearchFilter);
        setAnalyticSearchDraft(tokenSearchFilter);
    }

    const selectedFeedbackReviewIdKey = selectedFeedbackReview?.id ?? null;
    const selectedFeedbackReviewImprovement =
        selectedFeedbackReview?.aiImprovement ?? '';
    const [prevImprovementSync, setPrevImprovementSync] = useState<
        [number | null, string] | null
    >(null);

    if (
        prevImprovementSync === null ||
        prevImprovementSync[0] !== selectedFeedbackReviewIdKey ||
        prevImprovementSync[1] !== selectedFeedbackReviewImprovement
    ) {
        setPrevImprovementSync([
            selectedFeedbackReviewIdKey,
            selectedFeedbackReviewImprovement,
        ]);
        setImprovementDraft(selectedFeedbackReviewImprovement);
    }

    useEffect(() => {
        window.localStorage.setItem(
            'admin-sidebar-collapsed',
            sidebarCollapsed ? 'true' : 'false',
        );
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (activeSection !== 'analytic') {
            return;
        }

        const normalizedDraft = analyticSearchDraft.trim();
        const normalizedCurrent = filters?.tokenSearch?.trim() ?? '';

        if (normalizedDraft === normalizedCurrent) {
            return;
        }

        const timeout = window.setTimeout(() => {
            updateAnalyticFilters({
                search: analyticSearchDraft,
                page: 1,
            });
        }, 350);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [activeSection, analyticSearchDraft, filters?.tokenSearch]);

    useEffect(() => {
        if (activeSection !== 'feedback-review') {
            return;
        }

        const normalizedDraft = feedbackSearchDraft.trim();
        const normalizedCurrent = filters?.feedbackSearch?.trim() ?? '';

        if (normalizedDraft === normalizedCurrent) {
            return;
        }

        const timeout = window.setTimeout(() => {
            updateFeedbackReviewFilters({
                search: feedbackSearchDraft,
                status: feedbackStatus,
                page: 1,
            });
        }, 350);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [
        activeSection,
        feedbackSearchDraft,
        feedbackStatus,
        filters?.feedbackSearch,
    ]);

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

            url.searchParams.set('page', String(filters?.page ?? 1));

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
                setLiveActivityPagination(payload.pagination);
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
    }, [activeSection, activityPeriod, filters?.search, filters?.page]);

    const openCreateRoleDialog = () => {
        setSelectedRole(null);
        roleForm.clearErrors();
        roleForm.setData(emptyRoleForm);
        setRoleDialogOpen(true);
    };

    const openEditRoleDialog = (role: RoleItem) => {
        setSelectedRole(role);
        roleForm.clearErrors();
        roleForm.setData({
            slug: role.slug,
            name: role.name,
            description: role.description === '-' ? '' : role.description,
            permissions: role.permissions,
        });
        setRoleDialogOpen(true);
    };

    const closeRoleDialog = () => {
        setRoleDialogOpen(false);
        setSelectedRole(null);
        roleForm.clearErrors();
        roleForm.setData(emptyRoleForm);
    };

    const handleRoleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: closeRoleDialog,
        };

        if (selectedRole) {
            roleForm.put(`/admin/roles/${selectedRole.id}`, options);

            return;
        }

        roleForm.post('/admin/roles', options);
    };

    const handleDeleteRole = (role: RoleItem) => {
        if (role.system || role.usersCount > 0) {
            return;
        }

        if (!window.confirm(`Hapus role ${role.name}?`)) {
            return;
        }

        router.delete(`/admin/roles/${role.id}`, {
            preserveScroll: true,
        });
    };

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
            email_verified: user.emailVerified,
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

    const applyFeedbackReviewPayload = (
        id: number,
        payload: Partial<FeedbackReviewItem>,
    ) => {
        setLocalFeedbackReviewItems((items) =>
            items.map((item) =>
                item.id === id ? { ...item, ...payload } : item,
            ),
        );
    };

    const getCsrfToken = () =>
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

    const updateFeedbackReviewStatus = (
        id: number,
        status: FeedbackReviewItem['status'],
    ) => {
        setLocalFeedbackReviewItems((items) =>
            items.map((item) => (item.id === id ? { ...item, status } : item)),
        );

        const csrfToken = getCsrfToken();

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

    const completeFeedbackReview = (id: number, action: 'solve' | 'ignore') => {
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
            return;
        }

        const actionKey = `${action}:${id}`;
        setPendingFeedbackAction(actionKey);

        void fetch(`/admin/feedback-review/${id}/${action}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
            },
            body: JSON.stringify({
                ...(action === 'solve' && improvementDraft.trim() !== ''
                    ? { improvement: improvementDraft.trim() }
                    : {}),
            }),
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Failed to complete feedback review.');
                }

                const payload = (await response.json()) as {
                    data: Partial<FeedbackReviewItem> & { id: number };
                };

                applyFeedbackReviewPayload(id, payload.data);
            })
            .catch((error) => {
                console.error('Failed to complete feedback review:', error);
            })
            .finally(() => {
                setPendingFeedbackAction((current) =>
                    current === actionKey ? null : current,
                );
            });
    };

    const saveFeedbackImprovement = (id: number) => {
        const csrfToken = getCsrfToken();

        if (!csrfToken || improvementDraft.trim() === '') {
            return;
        }

        const actionKey = `save:${id}`;
        setPendingFeedbackAction(actionKey);

        void fetch(`/admin/feedback-review/${id}/improvement`, {
            method: 'PATCH',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
            },
            body: JSON.stringify({
                improvement: improvementDraft.trim(),
            }),
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Failed to save feedback improvement.');
                }

                const payload = (await response.json()) as {
                    data: Partial<FeedbackReviewItem> & { id: number };
                };

                applyFeedbackReviewPayload(id, payload.data);
            })
            .catch((error) => {
                console.error('Failed to save feedback improvement:', error);
            })
            .finally(() => {
                setPendingFeedbackAction((current) =>
                    current === actionKey ? null : current,
                );
            });
    };

    const rollbackFeedbackReview = (id: number) => {
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
            return;
        }

        const actionKey = `rollback:${id}`;
        setPendingFeedbackAction(actionKey);

        void fetch(`/admin/feedback-review/${id}/rollback`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
            },
            body: JSON.stringify({}),
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Failed to rollback feedback review.');
                }

                const payload = (await response.json()) as {
                    data: Partial<FeedbackReviewItem> & { id: number };
                };

                applyFeedbackReviewPayload(id, payload.data);
                setImprovementDraft('');
            })
            .catch((error) => {
                console.error('Failed to rollback feedback review:', error);
            })
            .finally(() => {
                setPendingFeedbackAction((current) =>
                    current === actionKey ? null : current,
                );
            });
    };

    return (
        <>
            <Head title="Admin Dashboard" />

            <div className="h-screen overflow-hidden bg-background text-foreground">
                <aside
                    className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#d9e4f2] bg-[#f7fbff] shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-[width] duration-200 lg:flex lg:flex-col ${
                        sidebarCollapsed ? 'w-20' : 'w-64'
                    }`}
                >
                    <div
                        className={`flex h-18 items-center border-b border-[#d9e4f2] px-4 ${
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
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-primary ring-1 ring-[#cfe0f5] transition-colors hover:bg-[#e4efff] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            onClick={() =>
                                setSidebarCollapsed((value) => !value)
                            }
                        >
                            <DekaLogo className="h-7 w-7 scale-125 object-contain" />
                        </button>
                        <div
                            className={`min-w-0 leading-none ${sidebarCollapsed ? 'hidden' : ''}`}
                        >
                            <p className="truncate text-[15px] leading-5 font-semibold text-[#1e293b]">
                                Deka Admin
                            </p>
                            <p className="mt-0.5 truncate text-xs leading-4 text-[#64748b]">
                                Chatbot operations
                            </p>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-4 px-3 py-4">
                        {sidebarNavigationGroups.map((group) => (
                            <div key={group.label} className="space-y-1.5">
                                <p
                                    className={`px-3 pb-1 text-[11px] leading-4 font-semibold tracking-[0.12em] text-[#94a3b8] uppercase ${
                                        sidebarCollapsed ? 'hidden' : ''
                                    }`}
                                >
                                    {group.label}
                                </p>
                                {group.items.map((item) => (
                                    <Link
                                        key={item.label}
                                        href={sectionHref(item.id)}
                                        title={
                                            sidebarCollapsed
                                                ? item.label
                                                : undefined
                                        }
                                        className={`group relative flex h-11 w-full items-center overflow-hidden rounded-xl text-sm font-medium transition-all ${
                                            activeSection === item.id
                                                ? 'bg-[#2563eb] text-white'
                                                : 'text-[#64748b] hover:bg-[#eef5ff] hover:text-[#1e3a8a]'
                                        } ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'}`}
                                    >
                                        <item.icon
                                            className={`h-4 w-4 shrink-0 transition-transform ${
                                                activeSection === item.id
                                                    ? 'text-white'
                                                    : 'text-[#64748b] group-hover:text-[#2563eb]'
                                            }`}
                                        />
                                        <span
                                            className={`truncate ${sidebarCollapsed ? 'hidden' : ''}`}
                                        >
                                            {item.label}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </nav>

                    <div className="border-t border-[#d9e4f2] p-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {sidebarCollapsed ? (
                                    <button
                                        type="button"
                                        title={auth.user.name}
                                        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#eef5ff] text-sm font-semibold text-primary ring-1 ring-[#cfe0f5] transition-colors hover:bg-[#e4efff] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        {profileInitials}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-xl border border-[#d9e4f2] bg-[#eef5ff] p-3 text-left transition-colors hover:bg-[#e4efff] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <UserInfo user={auth.user} showEmail />
                                        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#94a3b8]" />
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
                    <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/92 px-4 backdrop-blur md:px-6">
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

                    <main className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto bg-slate-50/70 px-4 py-6 md:px-6">
                        <div className="-mx-4 flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200/70 bg-white/80 px-4 pb-3 lg:hidden">
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
                                    className="h-9 shrink-0 rounded-full"
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

                                <div className="grid min-h-0 flex-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(340px,0.85fr)]">
                                    <Suspense
                                        fallback={
                                            <ChartFallback className="min-h-[320px]" />
                                        }
                                    >
                                        <AdminConversationChart
                                            data={chatTrendItems}
                                            className="flex h-full min-h-0 flex-col"
                                            chartClassName="h-[220px]"
                                        />
                                    </Suspense>
                                    <Suspense
                                        fallback={
                                            <ChartFallback className="min-h-[320px]" />
                                        }
                                    >
                                        <AdminFeedbackBarChart
                                            data={feedbackChartItems}
                                            className="flex min-h-0 flex-col"
                                            chartClassName="h-[220px]"
                                        />
                                    </Suspense>
                                    <Suspense
                                        fallback={
                                            <ChartFallback className="min-h-[320px]" />
                                        }
                                    >
                                        <AdminTokenUsageChart
                                            data={tokenUsageItems}
                                            trend={tokenUsageTrend}
                                            className="flex flex-col"
                                            chartClassName="h-[180px] max-h-[180px]"
                                        />
                                    </Suspense>
                                </div>
                            </section>
                        )}

                        {activeSection === 'analytic' && (
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

                                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
                                    <Suspense
                                        fallback={
                                            <ChartFallback className="min-h-[380px]" />
                                        }
                                    >
                                        <AdminTokenTrendChart
                                            data={tokenTrendItems}
                                            className="flex min-h-[380px] flex-col"
                                            chartClassName="h-full min-h-[260px]"
                                        />
                                    </Suspense>

                                    <Card className="rounded-lg">
                                        <CardHeader className="pb-4">
                                            <CardTitle>
                                                Ringkasan Statistik
                                            </CardTitle>
                                            <CardDescription>
                                                Efisiensi dan komposisi
                                                pemakaian token saat ini.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
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
                                                tone="blue"
                                                variant="hero"
                                            />
                                            <TokenTrendSummaryCard
                                                value={
                                                    tokenUsageTrendLabel.value
                                                }
                                                detail={
                                                    tokenUsageTrendLabel.detail
                                                }
                                            />
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <TokenInsightCard
                                                    label="Biaya / request"
                                                    value={formatUsd(
                                                        estimatedCostPerRequest,
                                                    )}
                                                    detail="Estimasi rata-rata biaya"
                                                    tone="green"
                                                    variant="compact"
                                                />
                                                <TokenInsightCard
                                                    label="Input : Output"
                                                    value={`${promptTokenShare}:${completionTokenShare}`}
                                                    detail="Rasio komposisi token"
                                                    tone="neutral"
                                                    variant="compact"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card className="rounded-lg">
                                    <CardHeader className="gap-3 pb-4">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Penggunaan token per user
                                                </CardTitle>
                                                <CardDescription>
                                                    Ringkasan token AI yang
                                                    dipakai tiap pengguna. Input
                                                    adalah token dari pertanyaan
                                                    dan konteks, output adalah
                                                    token jawaban AI.
                                                </CardDescription>
                                            </div>
                                            <div className="flex flex-col gap-3 lg:min-w-[520px] lg:items-end">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                                    <Input
                                                        value={
                                                            analyticSearchDraft
                                                        }
                                                        onChange={(event) =>
                                                            setAnalyticSearchDraft(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Cari nama atau email pengguna..."
                                                        className="w-full sm:w-[360px]"
                                                    />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                    <Badge
                                                        variant="secondary"
                                                        className="w-fit"
                                                    >
                                                        {formatNumber(
                                                            analyticTokenUsagePagination.total,
                                                        )}{' '}
                                                        pengguna terdata
                                                    </Badge>
                                                    {filters?.tokenSearch && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                updateAnalyticFilters(
                                                                    {
                                                                        page: 1,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            Reset filter
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col gap-4">
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                                            <TokenInsightCard
                                                label="Total request"
                                                value={formatNumber(
                                                    totalAiRequests,
                                                )}
                                                detail={`${formatNumber(averageTokensPerRequest)} token per request`}
                                            />
                                            <TokenInsightCard
                                                label="Total biaya"
                                                value={formatUsd(
                                                    estimatedTokenCost,
                                                )}
                                                detail="Estimasi input dan output"
                                            />
                                        </div>
                                        <div className="overflow-hidden rounded-md border">
                                            <div className="min-w-0">
                                                <div className="grid grid-cols-[minmax(220px,1fr)_90px_130px_130px_150px] items-center gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                    <span>Pengguna</span>
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
                                                {analyticTokenUsageItems.length >
                                                0 ? (
                                                    analyticTokenUsageItems.map(
                                                        (item) => (
                                                            <div
                                                                key={item.email}
                                                                className="grid grid-cols-[minmax(220px,1fr)_90px_130px_130px_150px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
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
                                        <div className="mt-1 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
                                            <p className="text-sm leading-6 text-muted-foreground">
                                                {analyticTokenUsagePagination.total >
                                                0
                                                    ? `Menampilkan ${analyticTokenUsagePagination.from}-${analyticTokenUsagePagination.to} dari ${analyticTokenUsagePagination.total} pengguna`
                                                    : 'Belum ada data analytic untuk filter ini.'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        analyticTokenUsagePagination.currentPage <=
                                                        1
                                                    }
                                                    onClick={() =>
                                                        updateAnalyticFilters({
                                                            search: analyticSearchDraft,
                                                            page:
                                                                analyticTokenUsagePagination.currentPage -
                                                                1,
                                                        })
                                                    }
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <div className="min-w-[132px] rounded-md border bg-muted/30 px-3 py-1.5 text-center text-sm text-foreground">
                                                    Halaman{' '}
                                                    {
                                                        analyticTokenUsagePagination.currentPage
                                                    }{' '}
                                                    /{' '}
                                                    {Math.max(
                                                        analyticTokenUsagePagination.lastPage,
                                                        1,
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        !analyticTokenUsagePagination.hasMorePages
                                                    }
                                                    onClick={() =>
                                                        updateAnalyticFilters({
                                                            search: analyticSearchDraft,
                                                            page:
                                                                analyticTokenUsagePagination.currentPage +
                                                                1,
                                                        })
                                                    }
                                                >
                                                    Berikutnya
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
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
                                        label="Diabaikan"
                                        tone="neutral"
                                        value={formatNumber(
                                            ignoredFeedbackReviews,
                                        )}
                                    />
                                </div>

                                <Card className="flex min-h-0 flex-col rounded-lg">
                                    <CardHeader className="gap-3">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Feedback yang perlu ditinjau
                                                </CardTitle>
                                                <CardDescription>
                                                    Tentukan masukan mana yang
                                                    perlu dipakai untuk
                                                    memperbaiki jawaban AI.
                                                </CardDescription>
                                            </div>
                                            <div className="flex flex-col gap-3 lg:min-w-[520px] lg:items-end">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                                    <Input
                                                        value={
                                                            feedbackSearchDraft
                                                        }
                                                        onChange={(event) =>
                                                            setFeedbackSearchDraft(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Cari user, email, alasan, issue..."
                                                        className="w-full sm:w-[360px]"
                                                    />
                                                    <Select
                                                        value={feedbackStatus}
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            updateFeedbackReviewFilters(
                                                                {
                                                                    search: feedbackSearchDraft,
                                                                    status: value as FeedbackStatusFilter,
                                                                    page: 1,
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full sm:w-[180px]">
                                                            <SelectValue placeholder="Semua status" />
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            <SelectItem value="all">
                                                                Semua status
                                                            </SelectItem>
                                                            <SelectItem value="open">
                                                                Baru
                                                            </SelectItem>
                                                            <SelectItem value="reviewing">
                                                                Sedang ditinjau
                                                            </SelectItem>
                                                            <SelectItem value="resolved">
                                                                Selesai
                                                            </SelectItem>
                                                            <SelectItem value="ignored">
                                                                Diabaikan
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                    <Badge
                                                        variant="secondary"
                                                        className="w-fit"
                                                    >
                                                        {formatNumber(
                                                            liveFeedbackReviewPagination.total,
                                                        )}{' '}
                                                        feedback masuk
                                                    </Badge>
                                                    {(filters?.feedbackSearch ||
                                                        feedbackStatus !==
                                                            'all') && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                updateFeedbackReviewFilters(
                                                                    {
                                                                        page: 1,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            Reset filter
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex min-h-0 flex-1 flex-col">
                                        <div className="min-h-0 flex-1 overflow-x-auto rounded-md border">
                                            <div className="min-w-[920px]">
                                                <div className="grid grid-cols-[minmax(170px,0.75fr)_minmax(250px,1fr)_minmax(360px,1.45fr)_150px_120px_170px] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                    <span>User</span>
                                                    <span>Alasan</span>
                                                    <span>Issue</span>
                                                    <span>Status</span>
                                                    <span>Waktu</span>
                                                    <span className="text-right">
                                                        Aksi
                                                    </span>
                                                </div>

                                                {feedbackReviewDisplayItems.length >
                                                0 ? (
                                                    feedbackReviewDisplayItems.map(
                                                        (item) => (
                                                            <div
                                                                key={item.id}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() =>
                                                                    setSelectedFeedbackReviewId(
                                                                        item.id,
                                                                    )
                                                                }
                                                                onKeyDown={(
                                                                    event,
                                                                ) => {
                                                                    if (
                                                                        event.key ===
                                                                            'Enter' ||
                                                                        event.key ===
                                                                            ' '
                                                                    ) {
                                                                        event.preventDefault();
                                                                        setSelectedFeedbackReviewId(
                                                                            item.id,
                                                                        );
                                                                    }
                                                                }}
                                                                className={`grid grid-cols-[minmax(170px,0.75fr)_minmax(250px,1fr)_minmax(360px,1.45fr)_150px_120px_170px] gap-3 border-b px-4 last:border-b-0 ${
                                                                    [
                                                                        'resolved',
                                                                        'ignored',
                                                                    ].includes(
                                                                        item.status,
                                                                    )
                                                                        ? 'bg-slate-50/70 py-3 text-muted-foreground'
                                                                        : 'cursor-pointer py-4 transition-colors hover:bg-muted/30'
                                                                }`}
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
                                                                <div className="min-w-0 space-y-2">
                                                                    <div>
                                                                        <p className="line-clamp-1 text-sm font-medium">
                                                                            {
                                                                                item.question
                                                                            }
                                                                        </p>
                                                                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                                            Jawaban
                                                                            lama:{' '}
                                                                            {
                                                                                item.answer
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                    {item.aiImprovement ? (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700"
                                                                        >
                                                                            Perbaikan
                                                                            tersimpan
                                                                        </Badge>
                                                                    ) : item.status ===
                                                                      'ignored' ? (
                                                                        <div className="text-xs leading-5 text-muted-foreground">
                                                                            Tidak
                                                                            dipakai
                                                                            untuk
                                                                            perbaikan
                                                                            AI.
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <FeedbackReviewStatusBadge
                                                                        status={
                                                                            item.status
                                                                        }
                                                                    />
                                                                    {item.status ===
                                                                    'resolved' ? (
                                                                        <p className="text-xs leading-4 text-emerald-700">
                                                                            Perbaikan
                                                                            aktif
                                                                        </p>
                                                                    ) : item.status ===
                                                                      'ignored' ? (
                                                                        <p className="text-xs leading-4 text-muted-foreground">
                                                                            Ditutup
                                                                            manual
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                                <p className="text-sm whitespace-nowrap text-muted-foreground">
                                                                    {
                                                                        item.createdAt
                                                                    }
                                                                </p>
                                                                <div className="flex flex-wrap justify-end gap-2">
                                                                    {[
                                                                        'resolved',
                                                                        'ignored',
                                                                    ].includes(
                                                                        item.status,
                                                                    ) ? (
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={(
                                                                                event,
                                                                            ) => {
                                                                                event.stopPropagation();
                                                                                setSelectedFeedbackReviewId(
                                                                                    item.id,
                                                                                );
                                                                            }}
                                                                        >
                                                                            Detail
                                                                        </Button>
                                                                    ) : (
                                                                        <>
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={
                                                                                    item.status !==
                                                                                    'open'
                                                                                }
                                                                                onClick={(
                                                                                    event,
                                                                                ) => {
                                                                                    event.stopPropagation();
                                                                                    updateFeedbackReviewStatus(
                                                                                        item.id,
                                                                                        'reviewing',
                                                                                    );
                                                                                }}
                                                                            >
                                                                                Review
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={
                                                                                    pendingFeedbackAction !==
                                                                                    null
                                                                                }
                                                                                onClick={(
                                                                                    event,
                                                                                ) => {
                                                                                    event.stopPropagation();
                                                                                    completeFeedbackReview(
                                                                                        item.id,
                                                                                        'ignore',
                                                                                    );
                                                                                }}
                                                                            >
                                                                                {pendingFeedbackAction ===
                                                                                `ignore:${item.id}`
                                                                                    ? 'Menutup...'
                                                                                    : 'Abaikan'}
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                disabled={
                                                                                    pendingFeedbackAction !==
                                                                                    null
                                                                                }
                                                                                onClick={(
                                                                                    event,
                                                                                ) => {
                                                                                    event.stopPropagation();
                                                                                    completeFeedbackReview(
                                                                                        item.id,
                                                                                        'solve',
                                                                                    );
                                                                                }}
                                                                            >
                                                                                {pendingFeedbackAction ===
                                                                                `solve:${item.id}`
                                                                                    ? 'Menyelesaikan...'
                                                                                    : 'Simpan perbaikan'}
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )
                                                ) : (
                                                    <EmptyTableRow text="Belum ada alasan dislike yang masuk." />
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
                                            <p className="text-sm leading-6 text-muted-foreground">
                                                {liveFeedbackReviewPagination.total >
                                                0
                                                    ? `Menampilkan ${liveFeedbackReviewPagination.from}-${liveFeedbackReviewPagination.to} dari ${liveFeedbackReviewPagination.total} feedback`
                                                    : 'Belum ada feedback untuk filter ini.'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        liveFeedbackReviewPagination.currentPage <=
                                                        1
                                                    }
                                                    onClick={() =>
                                                        updateFeedbackReviewFilters(
                                                            {
                                                                search: feedbackSearchDraft,
                                                                status: feedbackStatus,
                                                                page:
                                                                    liveFeedbackReviewPagination.currentPage -
                                                                    1,
                                                            },
                                                        )
                                                    }
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <div className="min-w-[132px] rounded-md border bg-muted/30 px-3 py-1.5 text-center text-sm text-foreground">
                                                    Halaman{' '}
                                                    {
                                                        liveFeedbackReviewPagination.currentPage
                                                    }{' '}
                                                    /{' '}
                                                    {Math.max(
                                                        liveFeedbackReviewPagination.lastPage,
                                                        1,
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        !liveFeedbackReviewPagination.hasMorePages
                                                    }
                                                    onClick={() =>
                                                        updateFeedbackReviewFilters(
                                                            {
                                                                search: feedbackSearchDraft,
                                                                status: feedbackStatus,
                                                                page:
                                                                    liveFeedbackReviewPagination.currentPage +
                                                                    1,
                                                            },
                                                        )
                                                    }
                                                >
                                                    Berikutnya
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {activeSection === 'chat-trend' && (
                            <section className="min-h-0">
                                <Suspense
                                    fallback={
                                        <ChartFallback className="min-h-[360px]" />
                                    }
                                >
                                    <AdminConversationChart
                                        data={chatTrendItems}
                                    />
                                </Suspense>
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
                                        {knowledgeItems.length > 0 ? (
                                            knowledgeItems.map((item) => (
                                                <div
                                                    key={`${item.title}-${item.source}`}
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
                                                                {item.chunks}{' '}
                                                                bagian data · v
                                                                {item.version ??
                                                                    '-'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                Aktif v
                                                                {item.activeVersion ??
                                                                    '-'}{' '}
                                                                ·{' '}
                                                                {item.changedChunks ??
                                                                    0}{' '}
                                                                bagian berubah ·
                                                                validasi{' '}
                                                                {item.probesPassed ??
                                                                    0}
                                                                /
                                                                {item.probesTotal ??
                                                                    0}
                                                            </p>
                                                            {item.validationError && (
                                                                <p className="mt-1 text-xs text-destructive">
                                                                    {
                                                                        item.validationError
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            item.status ===
                                                            'active'
                                                                ? 'secondary'
                                                                : 'outline'
                                                        }
                                                    >
                                                        {knowledgeStatusLabel(
                                                            item.status,
                                                        )}
                                                    </Badge>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                                                Belum ada dokumen pengetahuan
                                                yang tersimpan.
                                            </div>
                                        )}
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
                                            value={
                                                knowledgeStats.answerGrounding
                                            }
                                        />
                                        <QualityBar
                                            label="Pencarian data siap"
                                            value={
                                                knowledgeStats.retrievalReady
                                            }
                                        />
                                        <QualityBar
                                            label="Sumber jawaban tercatat"
                                            value={
                                                knowledgeStats.sourceTraceability
                                            }
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
                                            value="Kompatibel OpenAI"
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
                                            value="Streaming aktif"
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
                                        <div className="rounded-md border border-[#f5d08b] bg-[#fff4df] p-3 text-sm text-[#8a3c06]">
                                            <div className="flex items-center gap-2 font-medium">
                                                <AlertTriangle className="h-4 w-4" />
                                                Perlu review
                                            </div>
                                            <p className="mt-1 leading-5">
                                                Beberapa pertanyaan user belum
                                                memiliki sumber pengetahuan yang
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
                                                    Daftar Role
                                                </CardTitle>
                                                <CardDescription>
                                                    Kelola role yang bisa
                                                    dipilih untuk akun pengguna.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={openCreateRoleDialog}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Tambah Role
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-hidden rounded-md border">
                                            <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[minmax(260px,1fr)_120px_100px]">
                                                <span>Role</span>
                                                <span className="hidden md:block">
                                                    Akun
                                                </span>
                                                <span className="text-right">
                                                    Aksi
                                                </span>
                                            </div>

                                            {roleItems.length > 0 ? (
                                                roleItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(260px,1fr)_120px_100px]"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">
                                                                {item.name}
                                                            </p>
                                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                {
                                                                    item.description
                                                                }
                                                            </p>
                                                        </div>
                                                        <p className="hidden text-sm text-muted-foreground tabular-nums md:block">
                                                            {formatNumber(
                                                                item.usersCount,
                                                            )}
                                                        </p>
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
                                                                    item.system ||
                                                                    item.usersCount >
                                                                        0
                                                                }
                                                                onClick={() =>
                                                                    handleDeleteRole(
                                                                        item,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <EmptyTableRow text="Belum ada role yang tersedia." />
                                            )}
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
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div>
                                                <CardTitle>
                                                    Daftar Pengguna
                                                </CardTitle>
                                                <CardDescription>
                                                    User yang terdaftar di
                                                    chatbot Deka.
                                                </CardDescription>
                                            </div>
                                            <div className="flex flex-col gap-3 lg:min-w-[520px] lg:items-end">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                                    <Input
                                                        value={usersSearchDraft}
                                                        onChange={(event) =>
                                                            setUsersSearchDraft(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder="Cari nama atau email pengguna..."
                                                        className="w-full sm:w-[280px]"
                                                    />
                                                    <Select
                                                        value={usersRoleFilter}
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            setUsersRoleFilter(
                                                                value as UserRoleFilter,
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full sm:w-[180px]">
                                                            <SelectValue placeholder="Semua role" />
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            <SelectItem value="all">
                                                                Semua role
                                                            </SelectItem>
                                                            <SelectItem value="admin">
                                                                Admin
                                                            </SelectItem>
                                                            <SelectItem value="user">
                                                                User
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={
                                                            openCreateUserDialog
                                                        }
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        Tambah Pengguna
                                                    </Button>
                                                </div>
                                                {(usersSearchDraft.trim() !==
                                                    '' ||
                                                    usersRoleFilter !==
                                                        'all') && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setUsersSearchDraft(
                                                                '',
                                                            );
                                                            setUsersRoleFilter(
                                                                'all',
                                                            );
                                                        }}
                                                    >
                                                        Reset filter
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="min-h-0 flex-1">
                                        <div className="h-full overflow-hidden rounded-md border">
                                            <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[minmax(280px,1fr)_130px_140px_120px_110px]">
                                                <span>Pengguna</span>
                                                <span className="hidden md:block">
                                                    Role
                                                </span>
                                                <span className="hidden md:block">
                                                    Verifikasi
                                                </span>
                                                <span className="hidden md:block">
                                                    Chat
                                                </span>
                                                <span className="text-right">
                                                    Aksi
                                                </span>
                                            </div>

                                            {filteredAdminUsers.length > 0 ? (
                                                filteredAdminUsers.map(
                                                    (item) => (
                                                        <div
                                                            key={item.id}
                                                            className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(280px,1fr)_130px_140px_120px_110px]"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="truncate text-sm font-medium">
                                                                        {
                                                                            item.name
                                                                        }
                                                                    </p>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[10px] capitalize md:hidden"
                                                                    >
                                                                        {
                                                                            item.role
                                                                        }
                                                                    </Badge>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-[10px] md:hidden ${
                                                                            item.emailVerified
                                                                                ? 'border-transparent bg-[#e8f8ef] text-[#15803d]'
                                                                                : 'border-transparent bg-[#fff4df] text-[#b45309]'
                                                                        }`}
                                                                    >
                                                                        {item.emailVerified
                                                                            ? 'Verified'
                                                                            : 'Unverified'}
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
                                                                    className={
                                                                        item.emailVerified
                                                                            ? 'border-transparent bg-[#e8f8ef] text-[#15803d]'
                                                                            : 'border-transparent bg-[#fff4df] text-[#b45309]'
                                                                    }
                                                                >
                                                                    {item.emailVerified
                                                                        ? 'Verified'
                                                                        : 'Unverified'}
                                                                </Badge>
                                                            </div>
                                                            <p className="hidden text-sm text-muted-foreground tabular-nums md:block">
                                                                {formatNumber(
                                                                    item.conversations,
                                                                )}
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
                                                    ),
                                                )
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
                                                <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                                                    <span
                                                        className={`h-2.5 w-2.5 rounded-full ${
                                                            activityLiveStatus ===
                                                            'error'
                                                                ? 'bg-amber-500'
                                                                : activityLiveStatus ===
                                                                    'updating'
                                                                  ? 'bg-blue-500'
                                                                  : 'bg-emerald-500'
                                                        }`}
                                                    />
                                                    <span className="font-medium text-foreground">
                                                        {activityLiveStatus ===
                                                        'error'
                                                            ? 'Realtime tertunda'
                                                            : activityLiveStatus ===
                                                                'updating'
                                                              ? 'Memuat realtime'
                                                              : 'Live realtime'}
                                                    </span>
                                                    <span>
                                                        {reportPeriodLabel(
                                                            activityPeriod,
                                                        )}
                                                    </span>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-2 shadow-sm"
                                                        >
                                                            <Clock3 className="h-4 w-4" />
                                                            Periode
                                                            <ChevronDown className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-56"
                                                    >
                                                        <DropdownMenuLabel>
                                                            Periode laporan
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
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2 shadow-sm"
                                                    onClick={() =>
                                                        exportAdminActivityReport(
                                                            activityPeriod,
                                                            liveActivityItems,
                                                        )
                                                    }
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Export Excel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="gap-2 shadow-sm"
                                                    onClick={() =>
                                                        openActivityLogReport(
                                                            activityPeriod,
                                                            filters?.search,
                                                        )
                                                    }
                                                >
                                                    <Printer className="h-4 w-4" />
                                                    Export PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex min-h-0 flex-1 flex-col">
                                        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border">
                                            <div className="min-w-[880px]">
                                                <div className="sticky top-0 z-10 grid grid-cols-[minmax(220px,1fr)_140px_minmax(260px,1.2fr)_150px_150px] gap-3 border-b bg-background/95 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur supports-[backdrop-filter]:bg-background/85">
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
                                                                className="grid grid-cols-[minmax(220px,1fr)_140px_minmax(260px,1.2fr)_150px_150px] gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30"
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
                                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                                        {
                                                                            item.action
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 truncate text-xs leading-5 text-muted-foreground/90">
                                                                        {
                                                                            item.target
                                                                        }{' '}
                                                                        ·{' '}
                                                                        {
                                                                            item.detail
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <p className="font-mono text-sm text-muted-foreground/80">
                                                                    {
                                                                        item.ipAddress
                                                                    }
                                                                </p>
                                                                <p className="text-sm font-medium whitespace-nowrap text-muted-foreground">
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
                                        <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
                                            <p className="text-sm leading-6 text-muted-foreground">
                                                {liveActivityPagination.total >
                                                0
                                                    ? `Menampilkan ${liveActivityPagination.from}-${liveActivityPagination.to} dari ${liveActivityPagination.total} aktivitas`
                                                    : 'Belum ada aktivitas untuk filter ini.'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        liveActivityPagination.currentPage <=
                                                        1
                                                    }
                                                    onClick={() =>
                                                        updateActivityPage(
                                                            liveActivityPagination.currentPage -
                                                                1,
                                                            activityPeriod,
                                                            filters?.search,
                                                        )
                                                    }
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <div className="min-w-[132px] rounded-md border bg-muted/30 px-3 py-1.5 text-center text-sm text-foreground">
                                                    Halaman{' '}
                                                    {
                                                        liveActivityPagination.currentPage
                                                    }{' '}
                                                    /{' '}
                                                    {Math.max(
                                                        liveActivityPagination.lastPage,
                                                        1,
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        !liveActivityPagination.hasMorePages
                                                    }
                                                    onClick={() =>
                                                        updateActivityPage(
                                                            liveActivityPagination.currentPage +
                                                                1,
                                                            activityPeriod,
                                                            filters?.search,
                                                        )
                                                    }
                                                >
                                                    Berikutnya
                                                </Button>
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
                    <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold">
                                {selectedRole ? 'Edit Role' : 'Tambah Role'}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Kelola nama, slug, dan deskripsi role.
                            </p>
                        </div>

                        <form onSubmit={handleRoleSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="admin-role-name">Nama</Label>
                                <Input
                                    id="admin-role-name"
                                    value={roleForm.data.name}
                                    onChange={(event) =>
                                        roleForm.setData(
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                    required
                                    placeholder="Mis. Editor"
                                />
                                <InputError message={roleForm.errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-role-slug">Slug</Label>
                                <Input
                                    id="admin-role-slug"
                                    value={roleForm.data.slug}
                                    onChange={(event) =>
                                        roleForm.setData(
                                            'slug',
                                            event.target.value,
                                        )
                                    }
                                    required
                                    disabled={selectedRole !== null}
                                    placeholder="editor"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Slug dipakai untuk assignment user dan tidak
                                    bisa diubah setelah dibuat.
                                </p>
                                <InputError message={roleForm.errors.slug} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="admin-role-description">
                                    Deskripsi
                                </Label>
                                <textarea
                                    id="admin-role-description"
                                    value={roleForm.data.description}
                                    onChange={(event) =>
                                        roleForm.setData(
                                            'description',
                                            event.target.value,
                                        )
                                    }
                                    className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Ringkasan akses role"
                                />
                                <InputError
                                    message={roleForm.errors.description}
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
                                <Button
                                    type="submit"
                                    disabled={roleForm.processing}
                                >
                                    {selectedRole ? 'Simpan' : 'Tambah Role'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <Dialog
                open={selectedFeedbackReview !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedFeedbackReviewId(null);
                    }
                }}
            >
                <DialogContent className="max-h-[86vh] overflow-hidden p-0 sm:max-w-2xl">
                    {selectedFeedbackReview ? (
                        <>
                            <DialogHeader className="border-b px-6 py-5">
                                <div className="flex items-start justify-between gap-4 pr-8">
                                    <div className="min-w-0">
                                        <DialogTitle className="line-clamp-2 text-base leading-6">
                                            {selectedFeedbackReview.question}
                                        </DialogTitle>
                                        <DialogDescription className="mt-1">
                                            {
                                                selectedFeedbackReview.conversation
                                            }{' '}
                                            · {selectedFeedbackReview.createdAt}
                                        </DialogDescription>
                                    </div>
                                    <FeedbackReviewStatusBadge
                                        status={selectedFeedbackReview.status}
                                    />
                                </div>
                            </DialogHeader>

                            <div className="max-h-[58vh] scrollbar-none space-y-5 overflow-y-auto px-6 py-5">
                                <section className="space-y-2">
                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        User
                                    </p>
                                    <div className="rounded-md border bg-muted/20 p-3">
                                        <p className="text-sm font-medium">
                                            {selectedFeedbackReview.user}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {selectedFeedbackReview.email}
                                        </p>
                                    </div>
                                </section>

                                <section className="space-y-2">
                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        Alasan dislike
                                    </p>
                                    <p className="rounded-md border bg-background p-3 text-sm leading-6">
                                        {selectedFeedbackReview.reason}
                                    </p>
                                </section>

                                <section className="space-y-2">
                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        Jawaban lama
                                    </p>
                                    <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
                                        {selectedFeedbackReview.answer}
                                    </p>
                                </section>

                                <section className="space-y-2">
                                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        Perbaikan AI
                                    </p>
                                    {selectedFeedbackReview.status ===
                                    'ignored' ? (
                                        <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
                                            Feedback ini ditutup tanpa dipakai
                                            untuk perbaikan AI.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            <textarea
                                                value={improvementDraft}
                                                onChange={(event) =>
                                                    setImprovementDraft(
                                                        event.target.value,
                                                    )
                                                }
                                                className="min-h-32 w-full rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm leading-6 text-emerald-950 ring-offset-background placeholder:text-emerald-900/55 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                                                placeholder="Tulis perbaikan manual di sini. Jika dikosongkan lalu klik Simpan perbaikan, sistem akan membuat saran dari AI."
                                            />
                                            {(() => {
                                                const hasDraft =
                                                    improvementDraft.trim() !==
                                                    '';

                                                if (!hasDraft) {
                                                    return (
                                                        <p className="rounded-md border border-dashed bg-muted/10 p-3 text-sm leading-6 text-muted-foreground">
                                                            Belum ada perbaikan.
                                                            Tulis manual atau
                                                            klik Simpan
                                                            perbaikan untuk
                                                            membuat saran dari
                                                            AI.
                                                        </p>
                                                    );
                                                }

                                                const formattedDraft =
                                                    formatImprovementNote(
                                                        improvementDraft,
                                                    );

                                                return (
                                                    <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm leading-6 text-emerald-950">
                                                        <div className="space-y-2">
                                                            {formattedDraft.paragraphs.map(
                                                                (
                                                                    paragraph,
                                                                    index,
                                                                ) => (
                                                                    <p
                                                                        key={
                                                                            index
                                                                        }
                                                                    >
                                                                        {
                                                                            paragraph
                                                                        }
                                                                    </p>
                                                                ),
                                                            )}
                                                            {formattedDraft
                                                                .bullets
                                                                .length > 0 ? (
                                                                <ul className="list-disc space-y-2 pl-5">
                                                                    {formattedDraft.bullets.map(
                                                                        (
                                                                            bullet,
                                                                            index,
                                                                        ) => (
                                                                            <li
                                                                                key={
                                                                                    index
                                                                                }
                                                                            >
                                                                                {
                                                                                    bullet
                                                                                }
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </section>
                            </div>

                            <DialogFooter className="border-t px-6 py-4">
                                {selectedFeedbackReview.status ===
                                'resolved' ? (
                                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                            Feedback sudah selesai dan perbaikan
                                            aktif untuk jawaban berikutnya.
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={
                                                    pendingFeedbackAction !==
                                                        null ||
                                                    improvementDraft.trim() ===
                                                        ''
                                                }
                                                onClick={() =>
                                                    saveFeedbackImprovement(
                                                        selectedFeedbackReview.id,
                                                    )
                                                }
                                            >
                                                {pendingFeedbackAction ===
                                                `save:${selectedFeedbackReview.id}`
                                                    ? 'Menyimpan...'
                                                    : 'Simpan perubahan'}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={
                                                    pendingFeedbackAction !==
                                                    null
                                                }
                                                onClick={() =>
                                                    rollbackFeedbackReview(
                                                        selectedFeedbackReview.id,
                                                    )
                                                }
                                            >
                                                {pendingFeedbackAction ===
                                                `rollback:${selectedFeedbackReview.id}`
                                                    ? 'Mengembalikan...'
                                                    : 'Batalkan status selesai'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : selectedFeedbackReview.status ===
                                  'ignored' ? (
                                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                            Feedback sudah ditutup sebagai
                                            diabaikan.
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                pendingFeedbackAction !== null
                                            }
                                            onClick={() =>
                                                rollbackFeedbackReview(
                                                    selectedFeedbackReview.id,
                                                )
                                            }
                                        >
                                            {pendingFeedbackAction ===
                                            `rollback:${selectedFeedbackReview.id}`
                                                ? 'Mengembalikan...'
                                                : 'Buka kembali'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                selectedFeedbackReview.status !==
                                                'open'
                                            }
                                            onClick={() =>
                                                updateFeedbackReviewStatus(
                                                    selectedFeedbackReview.id,
                                                    'reviewing',
                                                )
                                            }
                                        >
                                            Tandai ditinjau
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                pendingFeedbackAction !== null
                                            }
                                            onClick={() =>
                                                completeFeedbackReview(
                                                    selectedFeedbackReview.id,
                                                    'ignore',
                                                )
                                            }
                                        >
                                            {pendingFeedbackAction ===
                                            `ignore:${selectedFeedbackReview.id}`
                                                ? 'Menutup...'
                                                : 'Abaikan feedback'}
                                        </Button>
                                        <Button
                                            type="button"
                                            disabled={
                                                pendingFeedbackAction !== null
                                            }
                                            onClick={() =>
                                                completeFeedbackReview(
                                                    selectedFeedbackReview.id,
                                                    'solve',
                                                )
                                            }
                                        >
                                            {pendingFeedbackAction ===
                                            `solve:${selectedFeedbackReview.id}`
                                                ? 'Menyelesaikan...'
                                                : 'Simpan perbaikan'}
                                        </Button>
                                    </div>
                                )}
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
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

                            <label
                                htmlFor="admin-user-email-verified"
                                className="flex items-start gap-3 rounded-md border bg-muted/20 p-3"
                            >
                                <input
                                    id="admin-user-email-verified"
                                    type="checkbox"
                                    checked={userForm.data.email_verified}
                                    onChange={(event) =>
                                        userForm.setData(
                                            'email_verified',
                                            event.target.checked,
                                        )
                                    }
                                    className="mt-1 size-4 rounded border-input"
                                />
                                <span>
                                    <span className="block text-sm font-medium">
                                        Email sudah terverifikasi
                                    </span>
                                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                        Jika aktif, akun bisa melewati proses
                                        verifikasi email. Jika nonaktif, user
                                        harus verifikasi email sebelum memakai
                                        area yang dilindungi.
                                    </span>
                                </span>
                            </label>
                            <InputError
                                message={userForm.errors.email_verified}
                            />

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
        <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm shadow-slate-900/4">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
                <div>
                    <CardDescription className="text-[13px] font-medium text-slate-500">
                        {metric.label}
                    </CardDescription>
                    <CardTitle className="mt-3 text-3xl tracking-tight text-slate-950">
                        {metric.value}
                    </CardTitle>
                </div>
                <span
                    className={`rounded-xl p-2.5 ring-1 ${toneClasses[metric.tone]}`}
                >
                    <Icon className="h-4 w-4" />
                </span>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-sm leading-6 text-slate-500">
                    {metric.description}
                </p>
            </CardContent>
        </Card>
    );
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

function logActivityExport(
    format: 'Excel' | 'PDF',
    period: ReportPeriod,
    itemCount: number,
) {
    const csrfToken = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    )?.content;

    void fetch('/admin/activity-log/export-log', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken ?? '',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
            format,
            period,
            item_count: itemCount,
        }),
    }).catch((error) => {
        console.error('Failed to log activity export:', error);
    });
}

function exportAdminActivityReport(
    period: ReportPeriod,
    items: AdminActivityItem[],
) {
    const periodLabel = reportPeriodLabel(period);
    const exportItems =
        items.length > 0
            ? items
            : [
                  {
                      id: 0,
                      admin: '-',
                      email: '-',
                      category: 'system' as const,
                      action: 'Tidak ada data aktivitas',
                      target: '-',
                      detail: `Tidak ada log untuk periode ${periodLabel}.`,
                      ipAddress: '-',
                      time: '-',
                  },
              ];
    const rowCount = exportItems.length;
    logActivityExport('Excel', period, items.length);
    const rows = exportItems
        .map((item, index) => {
            const activityText = `${escapeHtml(item.action)}${item.target ? ` - ${escapeHtml(item.target)}` : ''}`;
            const commentsText = `${escapeHtml(item.detail)} | ${escapeHtml(activityCategoryLabel(item.category))} | ${escapeHtml(item.admin)} | IP: ${escapeHtml(item.ipAddress)}`;

            return `
   <Row ss:Height="26">
    <Cell ss:StyleID="cellCenter"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="cellCenter"><Data ss:Type="String">${escapeHtml(item.time)}</Data></Cell>
    <Cell ss:StyleID="cellLeft"><Data ss:Type="String">${activityText}</Data></Cell>
    <Cell ss:StyleID="cellLeft"><Data ss:Type="String">${commentsText}</Data></Cell>
   </Row>`;
        })
        .join('');

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

    if (status === 'pending_validation') {
        return 'Menunggu validasi';
    }

    if (status === 'failed') {
        return 'Validasi gagal';
    }

    if (status === 'archived') {
        return 'Diarsipkan';
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
    tone = 'neutral',
    variant = 'default',
    value,
}: {
    detail: string;
    label: string;
    tone?: 'blue' | 'green' | 'amber' | 'neutral';
    variant?: 'default' | 'hero' | 'compact';
    value: string;
}) {
    const toneStyles = {
        blue: 'border-[#b9d8ff] bg-[#f4f9ff] text-[#155fc4]',
        green: 'border-[#bfe7cf] bg-[#f3fbf6] text-[#15803d]',
        amber: 'border-[#f5d08b] bg-[#fff8eb] text-[#b45309]',
        neutral: 'border-[#d9e4f2] bg-[#f7faff] text-[#40566f]',
    } satisfies Record<typeof tone, string>;
    const variantStyles = {
        default: {
            wrapper: 'rounded-xl p-3.5',
            value: 'mt-2.5 text-lg',
            detail: 'mt-1 text-xs leading-4.5',
        },
        hero: {
            wrapper: 'rounded-2xl p-5',
            value: 'mt-3 text-[1.95rem] leading-none',
            detail: 'mt-2 text-sm leading-5',
        },
        compact: {
            wrapper: 'rounded-xl p-3.5',
            value: 'mt-2 text-[1.35rem] leading-none',
            detail: 'mt-1 text-xs leading-5',
        },
    } satisfies Record<
        typeof variant,
        { wrapper: string; value: string; detail: string }
    >;

    return (
        <div
            className={`border shadow-sm ${toneStyles[tone]} ${variantStyles[variant].wrapper}`}
        >
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-80">
                {label}
            </p>
            <p
                className={`${variantStyles[variant].value} truncate font-semibold tracking-tight text-foreground`}
            >
                {value}
            </p>
            <p
                className={`${variantStyles[variant].detail} text-muted-foreground`}
            >
                {detail}
            </p>
        </div>
    );
}

function TokenTrendSummaryCard({
    detail,
    value,
}: {
    detail: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-[#f5d08b] bg-linear-to-br from-[#fff9ef] to-[#fff3db] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-[#b45309] uppercase">
                        Trend bulan ini
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                        {value}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        {detail}
                    </p>
                </div>
                <div className="rounded-full border border-[#f5d08b] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-[#b45309]">
                    Monthly
                </div>
            </div>
        </div>
    );
}

function FeedbackReviewStatusBadge({
    status,
}: {
    status: FeedbackReviewItem['status'];
}) {
    const labels: Record<FeedbackReviewItem['status'], string> = {
        open: 'Baru',
        reviewing: 'Sedang ditinjau',
        resolved: 'Selesai',
        ignored: 'Diabaikan',
    };
    const classes: Record<FeedbackReviewItem['status'], string> = {
        open: 'border-transparent bg-[#fff4df] text-[#b45309]  ',
        reviewing: 'border-transparent bg-[#eaf3ff] text-[#2f80ed]  ',
        resolved: 'border-transparent bg-[#e8f8ef] text-[#15803d]  ',
        ignored: 'border-transparent bg-[#f1f5f9] text-[#64748b]  ',
    };

    return (
        <Badge variant="outline" className={classes[status]}>
            {labels[status]}
        </Badge>
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

function getTokenUsageTrendLabel(trend?: TokenUsageTrend) {
    if (!trend || trend.changePercent === null) {
        return {
            value: 'Belum ada data',
            detail: 'Belum ada pembanding bulan lalu',
        };
    }

    if (trend.direction === 'flat' || trend.changePercent === 0) {
        return {
            value: 'Stabil',
            detail: 'Pemakaian token stabil bulan ini',
        };
    }

    const directionLabel = trend.direction === 'down' ? 'Turun' : 'Naik';

    return {
        value: `${directionLabel} ${formatPercent(trend.changePercent)}%`,
        detail: `${formatNumber(trend.currentTokens)} token bulan ini`,
    };
}

function formatPercent(value: number) {
    return new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 1,
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    }).format(Math.abs(value));
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
