<?php

namespace App\Services;

use App\Models\AdminActivityLog;
use App\Models\Conversation;
use App\Models\KnowledgeDocument;
use App\Models\KnowledgeDocumentVersion;
use App\Models\Message;
use App\Models\MessageFeedback;
use App\Models\Role;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

class AdminDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function props(string $section, Request $request): array
    {
        $tokenUsageSummaryItems = $this->tokenUsageItems();
        $tokenUsageItems = collect($tokenUsageSummaryItems)
            ->take(12)
            ->values()
            ->all();
        $analyticTokenUsageItems = $this->analyticTokenUsageItems(
            $request,
            $tokenUsageSummaryItems,
        );
        $adminUsers = $this->adminUsers($request);
        $adminActivityItems = $this->adminActivityItems($request);
        $feedbackReviewItems = $this->feedbackReviewItems($request);

        return [
            'section' => $section,
            'metrics' => $this->metrics($adminUsers),
            'tokenUsageItems' => $tokenUsageItems,
            'tokenUsageSummaryItems' => $tokenUsageSummaryItems,
            'analyticTokenUsageItems' => $analyticTokenUsageItems['items'],
            'analyticTokenUsagePagination' => $analyticTokenUsageItems['pagination'],
            'roleItems' => $this->roleItems(),
            'adminUsers' => $adminUsers,
            'adminActivityItems' => $adminActivityItems['items'],
            'adminActivityPagination' => $adminActivityItems['pagination'],
            'feedbackReviewItems' => $feedbackReviewItems['items'],
            'feedbackReviewPagination' => $feedbackReviewItems['pagination'],
            'knowledgeItems' => $this->knowledgeItems(),
            'knowledgeStats' => $this->knowledgeStats(),
            'chatTrendItems' => $this->chatTrendItems(),
            'feedbackChartItems' => $this->feedbackChartItems(),
            'tokenTrendItems' => $this->tokenTrendItems(),
            'tokenUsageTrend' => $this->tokenUsageTrend(),
            'totals' => [
                'totalTokenUsage' => array_sum(array_column($tokenUsageSummaryItems, 'totalTokens')),
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
                'page' => $this->activityPage($request),
                'feedbackSearch' => trim((string) $request->query('feedback_search', '')),
                'feedbackStatus' => $this->feedbackStatusFilter($request),
                'feedbackPage' => $this->feedbackPage($request),
                'tokenSearch' => trim((string) $request->query('token_search', '')),
                'tokenPage' => $this->tokenPage($request),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function activityLogPayload(Request $request): array
    {
        $adminActivityItems = $this->adminActivityItems($request);

        return [
            'adminActivityItems' => $adminActivityItems['items'],
            'pagination' => $adminActivityItems['pagination'],
            'totals' => $this->activityTotals(),
            'filters' => [
                'search' => trim((string) $request->query('search', '')),
                'period' => $this->periodFilter($request),
                'page' => $this->activityPage($request),
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
     * @param  array<int, array<string, mixed>>  $items
     * @return array{items: array<int, array<string, mixed>>, pagination: array<string, int|bool|null>}
     */
    private function analyticTokenUsageItems(
        Request $request,
        array $items,
    ): array {
        $search = trim((string) $request->query('token_search', ''));
        $page = $this->tokenPage($request);
        $perPage = 12;

        $filtered = collect($items)
            ->when($search !== '', function ($collection) use ($search) {
                return $collection->filter(function (array $item) use ($search): bool {
                    return str_contains(mb_strtolower((string) $item['user']), mb_strtolower($search))
                        || str_contains(mb_strtolower((string) $item['email']), mb_strtolower($search));
                });
            })
            ->values();

        $total = $filtered->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($page, $lastPage);
        $offset = ($currentPage - 1) * $perPage;
        $pageItems = $filtered->slice($offset, $perPage)->values();
        $countOnPage = $pageItems->count();

        return [
            'items' => $pageItems->all(),
            'pagination' => [
                'currentPage' => $currentPage,
                'lastPage' => $lastPage,
                'perPage' => $perPage,
                'total' => $total,
                'from' => $countOnPage > 0 ? $offset + 1 : null,
                'to' => $countOnPage > 0 ? $offset + $countOnPage : null,
                'hasMorePages' => $currentPage < $lastPage,
            ],
        ];
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
                $status = $lastSeen && $lastSeen->gte($activeSince) ? 'active' : 'inactive';

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $status,
                    'emailVerified' => $user->email_verified_at !== null,
                    'emailVerifiedAt' => $this->formattedDate($user->email_verified_at),
                    'joinedAt' => $this->formattedDate($user->created_at) ?? '-',
                    'lastSeen' => $this->relativeTime($lastSeen),
                    'conversations' => (int) $user->conversations_count,
                ];
            })
            ->all();
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, pagination: array<string, int|bool|null>}
     */
    private function adminActivityItems(Request $request): array
    {
        $paginator = $this->adminActivityPaginator($request);

        return [
            'items' => $this->mapAdminActivityItems($paginator->items()),
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'hasMorePages' => $paginator->hasMorePages(),
            ],
        ];
    }

    /**
     * @return LengthAwarePaginator<int, AdminActivityLog>
     */
    private function adminActivityPaginator(
        Request $request,
        int $perPage = 15,
    ): LengthAwarePaginator {
        return $this->adminActivityQuery($request)->paginate(
            $perPage,
            ['*'],
            'page',
            $this->activityPage($request),
        );
    }

    /**
     * @return Builder<AdminActivityLog>
     */
    private function adminActivityQuery(Request $request): Builder
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
            ->latest('id');
    }

    /**
     * @param  array<int, AdminActivityLog>  $items
     * @return array<int, array<string, mixed>>
     */
    private function mapAdminActivityItems(array $items): array
    {
        return collect($items)
            ->map(function (AdminActivityLog $item): array {
                $isLegacyMenuVisit = $item->action === 'Membuka menu admin';
                $target = $isLegacyMenuVisit ? 'Menu admin' : $item->target;
                $action = $isLegacyMenuVisit ? 'Membuka '.$item->target : $item->action;
                $detail = $isLegacyMenuVisit
                    ? 'Admin membuka menu '.$item->target.'.'
                    : ($item->description ?? '-');

                return [
                    'id' => $item->id,
                    'admin' => $item->admin->name,
                    'email' => $item->admin->email,
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

    private function activityPage(Request $request): int
    {
        return max(1, (int) $request->integer('page', 1));
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
     * @return array{items: array<int, array<string, mixed>>, pagination: array<string, int|bool|null>}
     */
    private function feedbackReviewItems(Request $request): array
    {
        $paginator = $this->feedbackReviewPaginator($request);

        return [
            'items' => collect($paginator->items())
                ->map(function (MessageFeedback $feedback): array {
                    $message = $feedback->message;

                    return [
                        'id' => $feedback->id,
                        'user' => $feedback->user->name,
                        'email' => $feedback->user->email,
                        'conversation' => $message?->conversation?->title ?: 'Percakapan tanpa judul',
                        'question' => str($message?->replyToMessage->content ?: '-')->limit(220)->toString(),
                        'answer' => str($message?->content ?: '-')->limit(180)->toString(),
                        'reason' => $feedback->reason ?: 'Tidak ada alasan tertulis',
                        'status' => $this->normalizedFeedbackReviewStatus($feedback->review_status),
                        'adminDecision' => $feedback->admin_decision,
                        'adminNote' => $feedback->admin_note,
                        'aiImprovement' => $feedback->ai_improvement,
                        'createdAt' => $this->relativeTime($feedback->created_at),
                    ];
                })
                ->all(),
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'hasMorePages' => $paginator->hasMorePages(),
            ],
        ];
    }

    /**
     * @return LengthAwarePaginator<int, MessageFeedback>
     */
    private function feedbackReviewPaginator(
        Request $request,
        int $perPage = 12,
    ): LengthAwarePaginator {
        return $this->feedbackReviewQuery($request)->paginate(
            $perPage,
            ['*'],
            'feedback_page',
            $this->feedbackPage($request),
        );
    }

    /**
     * @return Builder<MessageFeedback>
     */
    private function feedbackReviewQuery(Request $request): Builder
    {
        $search = trim((string) $request->query('feedback_search', ''));
        $status = $this->feedbackStatusFilter($request);

        return MessageFeedback::query()
            ->with([
                'user:id,name,email',
                'message:id,conversation_id,reply_to_message_id,content',
                'message.replyToMessage:id,content',
                'message.conversation:id,title',
            ])
            ->where('type', MessageFeedback::TYPE_DISLIKE)
            ->when($status !== 'all', function (Builder $query) use ($status): void {
                $query->where('review_status', $status);
            })
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('reason', 'like', "%{$search}%")
                        ->orWhereHas('user', function (Builder $query) use ($search): void {
                            $query->where('name', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        })
                        ->orWhereHas('message', function (Builder $query) use ($search): void {
                            $query->where('content', 'like', "%{$search}%")
                                ->orWhereHas('replyToMessage', function (Builder $query) use ($search): void {
                                    $query->where('content', 'like', "%{$search}%");
                                })
                                ->orWhereHas('conversation', function (Builder $query) use ($search): void {
                                    $query->where('title', 'like', "%{$search}%");
                                });
                        });
                });
            })
            ->latest('created_at')
            ->latest('id');
    }

    private function feedbackStatusFilter(Request $request): string
    {
        $status = trim((string) $request->query('feedback_status', 'all'));
        $allowed = [
            'all',
            MessageFeedback::REVIEW_STATUS_OPEN,
            MessageFeedback::REVIEW_STATUS_REVIEWING,
            MessageFeedback::REVIEW_STATUS_RESOLVED,
            MessageFeedback::REVIEW_STATUS_IGNORED,
        ];

        return in_array($status, $allowed, true) ? $status : 'all';
    }

    private function feedbackPage(Request $request): int
    {
        return max(1, (int) $request->integer('feedback_page', 1));
    }

    /**
     * @return array<int, array{title: string, source: string, chunks: int, status: string}>
     */
    private function knowledgeItems(): array
    {
        return KnowledgeDocument::query()
            ->with([
                'activeVersion.chunks',
                'versions' => fn ($query) => $query->latest('version')->limit(1),
            ])
            ->latest('last_ingested_at')
            ->latest('updated_at')
            ->limit(50)
            ->get()
            ->map(function (KnowledgeDocument $document): array {
                $latest = $document->versions->first();
                $validation = $latest !== null && is_array($latest->validation_summary)
                    ? $latest->validation_summary
                    : [];

                return [
                    'title' => $document->title ?: basename(parse_url($document->source_uri, PHP_URL_PATH) ?: $document->source_uri),
                    'source' => $this->knowledgeSourceLabel($document),
                    'chunks' => (int) ($document->activeVersion?->chunks->count() ?? 0),
                    'status' => $latest !== null ? $latest->status : $document->status,
                    'version' => $latest?->version,
                    'activeVersion' => $document->activeVersion?->version,
                    'changedChunks' => $latest !== null ? $latest->changed_chunks_count : 0,
                    'probesPassed' => (int) ($validation['probes_passed'] ?? 0),
                    'probesTotal' => (int) ($validation['probes_total'] ?? 0),
                    'validationError' => $validation['error'] ?? null,
                ];
            })
            ->all();
    }

    /**
     * @return array{answerGrounding: int, retrievalReady: int, sourceTraceability: int}
     */
    private function knowledgeStats(): array
    {
        $documentCount = KnowledgeDocument::query()->count();
        $activeDocumentCount = KnowledgeDocument::query()->where('status', 'active')->count();
        $activeVersions = KnowledgeDocumentVersion::query()
            ->where('status', 'active')
            ->withCount('chunks')
            ->get();
        $activeChunkCount = $activeVersions->sum('chunks_count');
        $validatedActiveVersions = $activeVersions->filter(
            function (KnowledgeDocumentVersion $version): bool {
                $summary = is_array($version->validation_summary)
                    ? $version->validation_summary
                    : [];

                return $version->validated_at !== null || (bool) ($summary['migrated'] ?? false);
            },
        )->count();
        $validationReadiness = $activeVersions->count() > 0
            ? (int) round(($validatedActiveVersions / $activeVersions->count()) * 100)
            : 0;
        $minimumDocuments = max(1, (int) config('services.deka_knowledge.min_active_documents_for_ready', 3));
        $minimumChunks = max(1, (int) config('services.deka_knowledge.min_active_chunks_for_ready', 20));
        $documentReadiness = min(100, (int) round(($activeDocumentCount / $minimumDocuments) * 100));
        $chunkReadiness = min(100, (int) round(($activeChunkCount / $minimumChunks) * 100));

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
            'retrievalReady' => (int) round(($documentReadiness * 0.3) + ($chunkReadiness * 0.4) + ($validationReadiness * 0.3)),
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
                    'month' => Carbon::parse($date)->format('F'),
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

    public function logReportExport(
        Request $request,
        string $format,
        string $periodLabel,
        int $itemCount,
    ): void {
        $user = $request->user();

        if (! $user) {
            return;
        }

        AdminActivityLog::query()->create([
            'admin_user_id' => $user->id,
            'category' => 'report',
            'action' => 'Export log aktivitas '.$format,
            'target' => 'Laporan Log Aktivitas',
            'description' => sprintf(
                'Admin mengekspor log aktivitas format %s untuk periode %s (%d baris).',
                $format,
                $periodLabel,
                $itemCount,
            ),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ]);
    }

    private function categoryForSection(string $section): string
    {
        return match ($section) {
            'users', 'roles' => 'user',
            'feedback-review' => 'conversation',
            'analytic' => 'report',
            default => 'system',
        };
    }

    private function labelForSection(string $section): string
    {
        return match ($section) {
            'analytic' => 'Analytic',
            'feedback-review' => 'Review Feedback',
            'users' => 'Kelola Pengguna',
            'roles' => 'Kelola Roles',
            'activity-log' => 'Log Aktivitas',
            default => 'Dashboard Ringkasan',
        };
    }

    private function tokenPage(Request $request): int
    {
        return max(1, (int) $request->integer('token_page', 1));
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

    private function formattedDate(CarbonInterface|string|null $time): ?string
    {
        if ($time === null) {
            return null;
        }

        return Carbon::parse($time)->format('j M Y');
    }

    private function formatNumber(int $value): string
    {
        return number_format($value, 0, ',', '.');
    }
}
