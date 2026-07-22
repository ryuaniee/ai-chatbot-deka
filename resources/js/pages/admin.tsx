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
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AdminConversationChart } from '@/components/admin-conversation-chart';
import { AdminFeedbackBarChart } from '@/components/admin-feedback-bar-chart';
import { AdminTokenTrendChart } from '@/components/admin-token-trend-chart';
import type { TokenTrendItem } from '@/components/admin-token-trend-chart';
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

type KnowledgeItem = {
    title: string;
    source: string;
    chunks: number;
    status: string;
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
    tokenUsageItems?: TokenUsageItem[];
    tokenUsageTrend?: TokenUsageTrend;
    tokenTrendItems?: TokenTrendItem[];
    roleItems?: RoleItem[];
    adminUsers?: AdminUserItem[];
    adminActivityItems?: AdminActivityItem[];
    feedbackReviewItems?: FeedbackReviewItem[];
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
    neutral:
        'bg-[#eef4fb] text-[#40566f] ring-[#d9e4f2]   ',
};

const statusClasses: Record<string, string> = {
    active: 'border-transparent bg-[#e8f2ff] text-[#155fc4]  ',
    inactive:
        'border-transparent bg-[#eef4fb] text-[#40566f]  ',
    Selesai:
        'border-transparent bg-[#e8f2ff] text-[#155fc4]  ',
    Berjalan:
        'border-transparent bg-[#eaf8ff] text-[#0369a1]  ',
};

const activityCategoryClasses: Record<AdminActivityItem['category'], string> = {
    auth: 'border-transparent bg-[#eef2ff] text-[#4338ca]  ',
    conversation:
        'border-transparent bg-[#e0f2fe] text-[#0369a1]  ',
    user: 'border-transparent bg-[#eff6ff] text-[#1d4ed8]  ',
    report: 'border-transparent bg-[#fff7ed] text-[#c2410c]  ',
    system: 'border-transparent bg-[#ecfdf5] text-[#047857]  ',
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
        tokenUsageItems = [],
        tokenUsageTrend,
        tokenTrendItems = [],
        roleItems = [],
        adminUsers = [],
        adminActivityItems = [],
        feedbackReviewItems = [],
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [liveActivityItems, setLiveActivityItems] =
        useState(adminActivityItems);
    const [liveActivityTotals, setLiveActivityTotals] =
        useState<ActivityLogTotals | null>(null);
    const [localFeedbackReviewItems, setLocalFeedbackReviewItems] =
        useState(feedbackReviewItems);
    const [pendingFeedbackAction, setPendingFeedbackAction] = useState<
        string | null
    >(null);
    const [selectedFeedbackReviewId, setSelectedFeedbackReviewId] = useState<
        number | null
    >(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(
        null,
    );
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
    const userForm = useForm<AdminUserFormData>(emptyAdminUserForm);
    const roleForm = useForm<RoleFormData>(emptyRoleForm);
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
    const estimatedCostPerRequest =
        estimatedTokenCost / Math.max(totalAiRequests, 1);
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
    const feedbackReviewDisplayItems = [...localFeedbackReviewItems].sort(
        (first, second) => {
            const statusOrder: Record<FeedbackReviewItem['status'], number> = {
                open: 0,
                reviewing: 1,
                resolved: 2,
                ignored: 3,
            };

            return statusOrder[first.status] - statusOrder[second.status];
        },
    );
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
            label: 'Menu',
            items: navigation.filter((item) =>
                ['overview', 'token-usage', 'feedback-review'].includes(
                    item.id,
                ),
            ),
        },
        {
            label: 'Admin',
            items: navigation.filter((item) =>
                ['users', 'roles', 'activity-log'].includes(item.id),
            ),
        },
    ];

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

    const completeFeedbackReview = (
        id: number,
        action: 'solve' | 'ignore',
    ) => {
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

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
            body: JSON.stringify({}),
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Failed to complete feedback review.');
                }

                const payload = (await response.json()) as {
                    data: Partial<FeedbackReviewItem> & { id: number };
                };

                setLocalFeedbackReviewItems((items) =>
                    items.map((item) =>
                        item.id === id ? { ...item, ...payload.data } : item,
                    ),
                );
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
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-primary ring-1 ring-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            onClick={() =>
                                setSidebarCollapsed((value) => !value)
                            }
                        >
                            <DekaLogo className="h-7 w-7 scale-125 object-contain" />
                        </button>
                        <div
                            className={`min-w-0 leading-none ${sidebarCollapsed ? 'hidden' : ''}`}
                        >
                            <p className="truncate text-[15px] leading-5 font-semibold text-foreground">
                                Deka Admin
                            </p>
                            <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                                Chatbot operations
                            </p>
                        </div>
                    </div>

                    <nav className="flex-1 space-y-3 px-3 py-3">
                        {sidebarNavigationGroups.map((group) => (
                            <div key={group.label} className="space-y-1">
                                <p
                                    className={`px-3 pb-0.5 text-[11px] leading-4 font-semibold tracking-wide text-muted-foreground/70 uppercase ${
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
                                        className={`flex h-10 w-full items-center rounded-md text-sm font-medium transition-colors ${
                                            activeSection === item.id
                                                ? 'bg-primary/90 text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        } ${sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0" />
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

                    <div className="border-t p-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {sidebarCollapsed ? (
                                    <button
                                        type="button"
                                        title={auth.user.name}
                                        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-primary ring-1 ring-border transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        {profileInitials}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-md border bg-muted/30 p-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

                    <main className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-6">
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
                                        trend={tokenUsageTrend}
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

                                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
                                    <AdminTokenTrendChart
                                        data={tokenTrendItems}
                                        className="flex min-h-[430px] flex-col"
                                        chartClassName="h-full min-h-[300px]"
                                    />

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
                                        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
                                                label="Trend bulan ini"
                                                value={
                                                    tokenUsageTrendLabel.value
                                                }
                                                detail={
                                                    tokenUsageTrendLabel.detail
                                                }
                                            />
                                            <TokenInsightCard
                                                label="Biaya / request"
                                                value={formatUsd(
                                                    estimatedCostPerRequest,
                                                )}
                                                detail="Estimasi rata-rata biaya"
                                            />
                                            <TokenInsightCard
                                                label="Input : Output"
                                                value={`${promptTokenShare}:${completionTokenShare}`}
                                                detail="Rasio komposisi token"
                                            />
                                        </CardContent>
                                    </Card>
                                </div>

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
                                                {tokenUsageItems.length > 0 ? (
                                                    tokenUsageItems.map(
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
                                        label="Solved"
                                        tone="green"
                                        value={formatNumber(
                                            resolvedFeedbackReviews,
                                        )}
                                    />
                                    <UserMetricCard
                                        icon={MessageSquare}
                                        label="Ignored"
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
                                                    Issue review dislike
                                                </CardTitle>
                                                <CardDescription>
                                                    Admin menentukan feedback
                                                    mana yang valid untuk
                                                    diperbaiki AI ke depannya.
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
                                                                    ['resolved', 'ignored'].includes(
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
                                                                            Improvement
                                                                            tersimpan
                                                                        </Badge>
                                                                    ) : item.status ===
                                                                      'ignored' ? (
                                                                        <div className="text-xs leading-5 text-muted-foreground">
                                                                            Tidak
                                                                            masuk
                                                                            learning
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
                                                                            Improvement
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
                                                                                    ? 'Closing'
                                                                                    : 'Ignore'}
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
                                                                                    ? 'Solving'
                                                                                    : 'Solve'}
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
                                                                {item.source}{' '}
                                                                · {item.chunks}{' '}
                                                                chunks
                                                            </p>
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
                                                Belum ada dokumen knowledge yang
                                                tersimpan.
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
                                        <div className="rounded-md border border-[#f5d08b] bg-[#fff4df] p-3 text-sm text-[#8a3c06]   ">
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
                                                    Kelola role yang bisa
                                                    dipilih untuk akun
                                                    pengguna.
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
                                            <div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[minmax(260px,1fr)_120px_120px_100px]">
                                                <span>Role</span>
                                                <span className="hidden md:block">
                                                    Tipe
                                                </span>
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
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(260px,1fr)_120px_120px_100px]"
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

                                            {adminUsers.length > 0 ? (
                                                adminUsers.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="grid grid-cols-[1fr_auto] gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(280px,1fr)_130px_140px_120px_110px]"
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
                                                            className="gap-2 shadow-sm"
                                                        >
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
                                                                className="grid grid-cols-[minmax(220px,1fr)_140px_minmax(260px,1.2fr)_150px_150px] gap-3 border-b px-4 py-4 transition-colors hover:bg-muted/30 last:border-b-0"
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
                                                                <p className="text-sm whitespace-nowrap font-medium text-muted-foreground">
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
                                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-20 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
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
                                            {
                                                selectedFeedbackReview.question
                                            }
                                        </DialogTitle>
                                        <DialogDescription className="mt-1">
                                            {
                                                selectedFeedbackReview.conversation
                                            }{' '}
                                            ·{' '}
                                            {
                                                selectedFeedbackReview.createdAt
                                            }
                                        </DialogDescription>
                                    </div>
                                    <FeedbackReviewStatusBadge
                                        status={selectedFeedbackReview.status}
                                    />
                                </div>
                            </DialogHeader>

                            <div className="scrollbar-none max-h-[58vh] space-y-5 overflow-y-auto px-6 py-5">
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
                                        Improvement AI
                                    </p>
                                    {selectedFeedbackReview.aiImprovement ? (
                                        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-sm leading-6 text-emerald-950">
                                            {
                                                selectedFeedbackReview.aiImprovement
                                            }
                                        </div>
                                    ) : selectedFeedbackReview.status ===
                                      'ignored' ? (
                                        <p className="rounded-md border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
                                            Feedback ini ditutup tanpa masuk ke
                                            learning AI.
                                        </p>
                                    ) : (
                                        <p className="rounded-md border border-dashed bg-muted/10 p-3 text-sm leading-6 text-muted-foreground">
                                            Belum ada improvement. Klik Solve
                                            jika feedback ini valid untuk
                                            memperbaiki jawaban berikutnya.
                                        </p>
                                    )}
                                </section>
                            </div>

                            <DialogFooter className="border-t px-6 py-4">
                                {['resolved', 'ignored'].includes(
                                    selectedFeedbackReview.status,
                                ) ? (
                                    <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                        {selectedFeedbackReview.status ===
                                        'resolved'
                                            ? 'Issue sudah solved dan improvement aktif untuk jawaban berikutnya.'
                                            : 'Issue sudah ditutup sebagai ignored.'}
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
                                            Review
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
                                                ? 'Closing'
                                                : 'Ignore'}
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
                                                ? 'Solving'
                                                : 'Solve'}
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
        resolved: 'Solved',
        ignored: 'Ignored',
    };
    const classes: Record<FeedbackReviewItem['status'], string> = {
        open: 'border-transparent bg-[#fff4df] text-[#b45309]  ',
        reviewing:
            'border-transparent bg-[#eaf3ff] text-[#2f80ed]  ',
        resolved:
            'border-transparent bg-[#e8f8ef] text-[#15803d]  ',
        ignored:
            'border-transparent bg-[#f1f5f9] text-[#64748b]  ',
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
