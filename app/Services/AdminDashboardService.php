<?php

namespace App\Services;

use App\Models\AdminActivityLog;
use App\Models\Conversation;
use App\Models\KnowledgeDocument;
use App\Models\Message;
use App\Models\MessageFeedback;
use App\Models\Role;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function props(string $section, Request $request): array
    {
        $tokenUsageItems = $this->tokenUsageItems();
        $adminUsers = $this->adminUsers($request);
        $adminActivityItems = $this->adminActivityItems($request);

        return [
            'section' => $section,
            'metrics' => $this->metrics($adminUsers),
            'tokenUsageItems' => $tokenUsageItems,
            'roleItems' => $this->roleItems(),
            'adminUsers' => $adminUsers,
            'adminActivityItems' => $adminActivityItems,
            'feedbackReviewItems' => $this->feedbackReviewItems(),
            'knowledgeItems' => $this->knowledgeItems(),
            'knowledgeStats' => $this->knowledgeStats(),
            'chatTrendItems' => $this->chatTrendItems(),
            'feedbackChartItems' => $this->feedbackChartItems(),
            'tokenTrendItems' => $this->tokenTrendItems(),
            'tokenUsageTrend' => $this->tokenUsageTrend(),
            'totals' => [
                'totalTokenUsage' => array_sum(array_column($tokenUsageItems, 'totalTokens')),
                'totalLikes' => MessageFeedback::query()->where('type', MessageFeedback::TYPE_LIKE)->count(),
                'totalDislikes' => MessageFeedback::query()->where('type', MessageFeedback::TYPE_DISLIKE)->count(),
                'activeUsers' => collect($adminUsers)->where('status', 'active')->count(),
                'adminUserCount' => collect($adminUsers)->where('role', User::ROLE_ADMIN)->count(),
                'totalUserConversations' => array_sum(array_column($adminUsers, 'conversations')),
                ...$this->activityTotals(),
            ],
            'filters' => [
                'search' => trim((string) $request->query('search', '')),
                'period' => $this->periodFilter($request),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function activityLogPayload(Request $request): array
    {
        return [
            'adminActivityItems' => $this->adminActivityItems($request),
            'totals' => $this->activityTotals(),
            'filters' => [
                'search' => trim((string) $request->query('search', '')),
                'period' => $this->periodFilter($request),
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $adminUsers
     * @return array<int, array<string, string>>
     */
    private function metrics(array $adminUsers): array
    {
        return [
            [
                'label' => 'Total Percakapan',
                'value' => $this->formatNumber(Conversation::query()->count()),
                'description' => 'Seluruh percakapan yang tersimpan di database.',
                'tone' => 'blue',
                'icon' => 'message',
            ],
            [
                'label' => 'Total Like',
                'value' => $this->formatNumber(MessageFeedback::query()->where('type', MessageFeedback::TYPE_LIKE)->count()),
                'description' => 'Feedback positif dari jawaban chatbot.',
                'tone' => 'green',
                'icon' => 'thumbsUp',
            ],
            [
                'label' => 'Total Dislike',
                'value' => $this->formatNumber(MessageFeedback::query()->where('type', MessageFeedback::TYPE_DISLIKE)->count()),
                'description' => 'Feedback negatif yang perlu dipantau.',
                'tone' => 'amber',
                'icon' => 'thumbsDown',
            ],
            [
                'label' => 'User Aktif',
                'value' => $this->formatNumber(collect($adminUsers)->where('status', 'active')->count()),
                'description' => 'Pengguna dengan aktivitas chat dalam 30 hari terakhir.',
                'tone' => 'neutral',
                'icon' => 'users',
            ],
        ];
    }

    /**
     * @return array<int, array{id: int, slug: string, name: string, description: string, permissions: array<int, string>, usersCount: int, system: bool}>
     */
    private function roleItems(): array
    {
        $userCounts = User::query()
            ->selectRaw('role, count(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        return Role::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(static fn (Role $role): array => [
                'id' => $role->id,
                'slug' => $role->slug,
                'name' => $role->name,
                'description' => $role->description ?? '-',
                'permissions' => $role->permissions ?? [],
                'usersCount' => (int) ($userCounts[$role->slug] ?? 0),
                'system' => $role->system,
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function tokenUsageItems(): array
    {
        return User::query()
            ->select(['id', 'name', 'email', 'role'])
            ->with(['conversations.messages' => fn ($query) => $query
                ->where('role', 'assistant')
                ->select(['id', 'conversation_id', 'role', 'metadata'])])
            ->get()
            ->map(function (User $user): array {
                $requests = 0;
                $promptTokens = 0;
                $completionTokens = 0;
                $totalTokens = 0;

                foreach ($user->conversations as $conversation) {
                    foreach ($conversation->messages as $message) {
                        $metadata = $message->metadata ?? [];
                        $usage = is_array($metadata['usage'] ?? null) ? $metadata['usage'] : [];
                        $prompt = (int) ($usage['prompt_tokens'] ?? 0);
                        $completion = (int) ($usage['completion_tokens'] ?? 0);
                        $total = (int) ($usage['total_tokens'] ?? ($prompt + $completion));

                        if ($prompt > 0 || $completion > 0 || $total > 0) {
                            $requests++;
                        }

                        $promptTokens += $prompt;
                        $completionTokens += $completion;
                        $totalTokens += $total;
                    }
                }

                return [
                    'user' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'requests' => $requests,
                    'promptTokens' => $promptTokens,
                    'completionTokens' => $completionTokens,
                    'totalTokens' => $totalTokens,
                ];
            })
            ->filter(fn (array $item): bool => $item['requests'] > 0 || $item['totalTokens'] > 0)
            ->sortByDesc('totalTokens')
            ->take(12)
            ->values()
            ->all();
    }

    /**
     * @return array{currentTokens: int, previousTokens: int, changePercent: float|null, direction: string}
     */
    private function tokenUsageTrend(): array
    {
        $now = now();
        $currentStart = $now->copy()->startOfMonth();
        $previousStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $previousEnd = $currentStart->copy()->subSecond();

        $currentTokens = $this->tokenUsageTotalBetween($currentStart, $now);
        $previousTokens = $this->tokenUsageTotalBetween($previousStart, $previousEnd);
        $changePercent = $previousTokens > 0
            ? round((($currentTokens - $previousTokens) / $previousTokens) * 100, 1)
            : null;

        return [
            'currentTokens' => $currentTokens,
            'previousTokens' => $previousTokens,
            'changePercent' => $changePercent,
            'direction' => match (true) {
                $changePercent === null => 'neutral',
                $changePercent > 0 => 'up',
                $changePercent < 0 => 'down',
                default => 'flat',
            },
        ];
    }

    /**
     * @return array<int, array{date: string, promptTokens: int, completionTokens: int, totalTokens: int, requests: int}>
     */
    private function tokenTrendItems(): array
    {
        $end = now()->startOfDay();
        $start = $end->copy()->subDays(29);
        $items = [];

        foreach (range(0, 29) as $offset) {
            $date = $start->copy()->addDays($offset);

            $items[$date->toDateString()] = [
                'date' => $date->toDateString(),
                'promptTokens' => 0,
                'completionTokens' => 0,
                'totalTokens' => 0,
                'requests' => 0,
            ];
        }

        Message::query()
            ->where('role', 'assistant')
            ->whereBetween('created_at', [$start, $end->copy()->endOfDay()])
            ->get(['created_at', 'metadata'])
            ->each(function (Message $message) use (&$items): void {
                $date = $message->created_at?->toDateString();

                if (! $date || ! isset($items[$date])) {
                    return;
                }

                $usage = is_array($message->metadata['usage'] ?? null)
                    ? $message->metadata['usage']
                    : [];
                $prompt = (int) ($usage['prompt_tokens'] ?? 0);
                $completion = (int) ($usage['completion_tokens'] ?? 0);
                $total = (int) ($usage['total_tokens'] ?? ($prompt + $completion));

                if ($prompt > 0 || $completion > 0 || $total > 0) {
                    $items[$date]['requests']++;
                }

                $items[$date]['promptTokens'] += $prompt;
                $items[$date]['completionTokens'] += $completion;
                $items[$date]['totalTokens'] += $total;
            });

        return array_values($items);
    }

    private function tokenUsageTotalBetween(CarbonInterface $start, CarbonInterface $end): int
    {
        return Message::query()
            ->where('role', 'assistant')
            ->whereBetween('created_at', [$start, $end])
            ->get(['metadata'])
            ->sum(function (Message $message): int {
                $usage = is_array($message->metadata['usage'] ?? null)
                    ? $message->metadata['usage']
                    : [];

                return (int) ($usage['total_tokens']
                    ?? ((int) ($usage['prompt_tokens'] ?? 0) + (int) ($usage['completion_tokens'] ?? 0)));
            });
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function adminUsers(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $activeSince = now()->subDays(30);

        return User::query()
            ->withCount('conversations')
            ->withMax('conversations', 'last_message_at')
            ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('role', 'like', "%{$search}%");
            }))
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(function (User $user) use ($activeSince): array {
                $lastSeen = $user->conversations_max_last_message_at
                    ? Carbon::parse($user->conversations_max_last_message_at)
                    : null;

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $lastSeen && $lastSeen->gte($activeSince) ? 'active' : 'inactive',
                    'emailVerified' => $user->email_verified_at !== null,
                    'emailVerifiedAt' => $user->email_verified_at?->locale('id')->translatedFormat('j M Y'),
                    'joinedAt' => $user->created_at?->locale('id')->translatedFormat('j M Y') ?? '-',
                    'lastSeen' => $this->relativeTime($lastSeen),
                    'conversations' => (int) $user->conversations_count,
                ];
            })
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function adminActivityItems(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $period = $this->periodFilter($request);

        return AdminActivityLog::query()
            ->with('admin:id,name,email')
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('category', 'like', "%{$search}%")
                        ->orWhere('action', 'like', "%{$search}%")
                        ->orWhere('target', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('ip_address', 'like', "%{$search}%")
                        ->orWhereHas('admin', function (Builder $query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        });
                });
            })
            ->where('created_at', '>=', $this->periodStart($period))
            ->latest('created_at')
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(function (AdminActivityLog $item): array {
                $isLegacyMenuVisit = $item->action === 'Membuka menu admin';
                $target = $isLegacyMenuVisit ? 'Menu admin' : $item->target;
                $action = $isLegacyMenuVisit ? 'Membuka '.$item->target : $item->action;
                $detail = $isLegacyMenuVisit
                    ? 'Admin membuka menu '.$item->target.'.'
                    : ($item->description ?? '-');

                return [
                    'id' => $item->id,
                    'admin' => $item->admin?->name ?? 'Admin',
                    'email' => $item->admin?->email ?? '-',
                    'category' => $this->normalizedActivityCategory($item->category),
                    'action' => $action,
                    'target' => $target,
                    'detail' => $detail,
                    'ipLabel' => $this->ipLabel($item->ip_address),
                    'ipAddress' => $item->ip_address ?? '-',
                    'createdAt' => $item->created_at?->toIso8601String(),
                    'time' => $this->relativeTime($item->created_at),
                ];
            })
            ->all();
    }

    private function ipLabel(?string $ipAddress): string
    {
        return match ($ipAddress) {
            null, '' => '-',
            '::1', '127.0.0.1' => 'localhost',
            default => $ipAddress,
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function feedbackReviewItems(): array
    {
        return MessageFeedback::query()
            ->with([
                'user:id,name,email',
                'message:id,conversation_id,reply_to_message_id,content',
                'message.replyToMessage:id,content',
                'message.conversation:id,title',
            ])
            ->where('type', MessageFeedback::TYPE_DISLIKE)
            ->latest('created_at')
            ->limit(50)
            ->get()
            ->map(function (MessageFeedback $feedback): array {
                $message = $feedback->message;

                return [
                    'id' => $feedback->id,
                    'user' => $feedback->user?->name ?? 'User',
                    'email' => $feedback->user?->email ?? '-',
                    'conversation' => $message?->conversation?->title ?: 'Percakapan tanpa judul',
                    'question' => str($message?->replyToMessage?->content ?? '-')->limit(220)->toString(),
                    'answer' => str($message?->content ?? '-')->limit(180)->toString(),
                    'reason' => $feedback->reason ?: 'Tidak ada alasan tertulis',
                    'status' => $this->normalizedFeedbackReviewStatus($feedback->review_status),
                    'adminDecision' => $feedback->admin_decision,
                    'adminNote' => $feedback->admin_note,
                    'aiImprovement' => $feedback->ai_improvement,
                    'createdAt' => $this->relativeTime($feedback->created_at),
                ];
            })
            ->all();
    }

    /**
     * @return array<int, array{title: string, source: string, chunks: int, status: string}>
     */
    private function knowledgeItems(): array
    {
        return KnowledgeDocument::query()
            ->withCount('chunks')
            ->latest('last_ingested_at')
            ->latest('updated_at')
            ->limit(50)
            ->get()
            ->map(fn (KnowledgeDocument $document): array => [
                'title' => $document->title ?: basename(parse_url($document->source_uri, PHP_URL_PATH) ?: $document->source_uri),
                'source' => $this->knowledgeSourceLabel($document),
                'chunks' => (int) $document->chunks_count,
                'status' => $document->status,
            ])
            ->all();
    }

    /**
     * @return array{answerGrounding: int, retrievalReady: int, sourceTraceability: int}
     */
    private function knowledgeStats(): array
    {
        $documentCount = KnowledgeDocument::query()->count();
        $activeDocumentCount = KnowledgeDocument::query()->where('status', 'active')->count();
        $activeChunkCount = KnowledgeDocument::query()
            ->where('status', 'active')
            ->withCount('chunks')
            ->get()
            ->sum('chunks_count');

        $assistantMessages = Message::query()->where('role', 'assistant')->count();
        $groundedMessages = Message::query()
            ->where('role', 'assistant')
            ->get(['metadata'])
            ->filter(fn (Message $message): bool => filled($message->metadata['knowledge'] ?? null))
            ->count();

        return [
            'answerGrounding' => $assistantMessages > 0
                ? min(100, (int) round(($groundedMessages / $assistantMessages) * 100))
                : 0,
            'retrievalReady' => min(100, (int) round(($activeDocumentCount * 30) + ($activeChunkCount > 0 ? 40 : 0))),
            'sourceTraceability' => $documentCount > 0
                ? min(100, (int) round(($activeDocumentCount / $documentCount) * 100))
                : 0,
        ];
    }

    private function knowledgeSourceLabel(KnowledgeDocument $document): string
    {
        return match ($document->source_type) {
            'url', 'website', 'crawl' => 'Website',
            'file' => 'File',
            'text' => 'Teks manual',
            default => str($document->source_type)->replace('_', ' ')->headline()->toString(),
        };
    }

    /**
     * @return array{activityToday: int, conversationActions: int, reportExports: int}
     */
    private function activityTotals(): array
    {
        return [
            'activityToday' => AdminActivityLog::query()->whereDate('created_at', now()->toDateString())->count(),
            'conversationActions' => AdminActivityLog::query()->where('category', 'conversation')->count(),
            'reportExports' => AdminActivityLog::query()->where('category', 'report')->count(),
        ];
    }

    /**
     * @return array<int, array{date: string, conversations: int}>
     */
    private function chatTrendItems(): array
    {
        $start = now()->subDays(89)->startOfDay();
        $rows = Conversation::query()
            ->where('created_at', '>=', $start)
            ->get(['created_at', 'last_message_at'])
            ->groupBy(fn (Conversation $conversation): string => ($conversation->last_message_at ?? $conversation->created_at)->toDateString());

        return collect(range(0, 89))
            ->map(function (int $offset) use ($start, $rows): array {
                $date = $start->copy()->addDays($offset)->toDateString();
                $dayRows = $rows->get($date, collect());

                return [
                    'date' => $date,
                    'conversations' => $dayRows->count(),
                ];
            })
            ->all();
    }

    /**
     * @return array<int, array{month: string, likes: int, dislikes: int}>
     */
    private function feedbackChartItems(): array
    {
        $start = now()->subMonths(5)->startOfMonth();
        $rows = MessageFeedback::query()
            ->where('created_at', '>=', $start)
            ->get(['type', 'created_at'])
            ->groupBy(fn (MessageFeedback $feedback): string => $feedback->created_at->format('Y-m'));

        return collect(range(0, 5))
            ->map(function (int $offset) use ($start, $rows): array {
                $date = $start->copy()->addMonths($offset);
                $monthRows = $rows->get($date->format('Y-m'), collect());

                return [
                    'month' => $date->locale('id')->translatedFormat('F'),
                    'likes' => $monthRows->where('type', MessageFeedback::TYPE_LIKE)->count(),
                    'dislikes' => $monthRows->where('type', MessageFeedback::TYPE_DISLIKE)->count(),
                ];
            })
            ->all();
    }

    public function logVisit(Request $request, string $section): void
    {
        $user = $request->user();

        if (! $user) {
            return;
        }

        AdminActivityLog::query()->create([
            'admin_user_id' => $user->id,
            'category' => $this->categoryForSection($section),
            'action' => 'Membuka '.$this->labelForSection($section),
            'target' => 'Menu admin',
            'description' => 'Admin membuka menu '.$this->labelForSection($section).'.',
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ]);
    }

    private function categoryForSection(string $section): string
    {
        return match ($section) {
            'users', 'roles' => 'user',
            'feedback-review' => 'conversation',
            'token-usage' => 'report',
            default => 'system',
        };
    }

    private function labelForSection(string $section): string
    {
        return match ($section) {
            'token-usage' => 'Token Usage',
            'feedback-review' => 'Review Feedback',
            'users' => 'Kelola Pengguna',
            'roles' => 'Kelola Roles',
            'activity-log' => 'Log Aktivitas',
            default => 'Dashboard Ringkasan',
        };
    }

    private function periodFilter(Request $request): string
    {
        $period = $request->query('period');

        return in_array($period, ['week', 'month', 'year'], true) ? $period : 'month';
    }

    private function periodStart(string $period): CarbonInterface
    {
        return match ($period) {
            'week' => now()->subDays(7),
            'month' => now()->subMonth(),
            'year' => now()->subYear(),
            default => now()->subMonth(),
        };
    }

    private function normalizedActivityCategory(?string $category): string
    {
        return in_array($category, ['auth', 'conversation', 'user', 'report', 'system'], true)
            ? $category
            : 'system';
    }

    private function normalizedFeedbackReviewStatus(?string $status): string
    {
        return in_array($status, [
            MessageFeedback::REVIEW_STATUS_OPEN,
            MessageFeedback::REVIEW_STATUS_REVIEWING,
            MessageFeedback::REVIEW_STATUS_RESOLVED,
            MessageFeedback::REVIEW_STATUS_IGNORED,
        ], true) ? $status : MessageFeedback::REVIEW_STATUS_OPEN;
    }

    private function relativeTime(?CarbonInterface $time): string
    {
        return $time?->locale('id')->diffForHumans() ?? '-';
    }

    private function formatNumber(int $value): string
    {
        return number_format($value, 0, ',', '.');
    }
}
