<?php

namespace App\Http\Controllers;

use App\Models\MessageFeedback;
use App\Services\AdminDashboardService;
use App\Services\FeedbackImprovementService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    private const SECTIONS = [
        'overview',
        'analytic',
        'feedback-review',
        'users',
        'roles',
        'activity-log',
    ];

    public function __invoke(
        Request $request,
        string $section,
        AdminDashboardService $dashboardService,
    ): Response {
        abort_unless(in_array($section, self::SECTIONS, true), 404);

        $dashboardService->logVisit($request, $section);

        return Inertia::render('admin', $dashboardService->props($section, $request));
    }

    public function activityLogItems(
        Request $request,
        AdminDashboardService $dashboardService,
    ): JsonResponse {
        return response()->json($dashboardService->activityLogPayload($request));
    }

    public function activityLogReport(
        Request $request,
        AdminDashboardService $dashboardService,
    ): View {
        $payload = $dashboardService->activityLogPayload($request);
        $period = (string) ($payload['filters']['period'] ?? 'month');
        $periodLabels = [
            'week' => 'Mingguan',
            'month' => 'Bulanan',
            'year' => 'Tahunan',
        ];
        $periodLabel = (string) ($periodLabels[$period] ?? $periodLabels['month']);

        $dashboardService->logReportExport(
            $request,
            'PDF',
            $periodLabel,
            count($payload['adminActivityItems'] ?? []),
        );

        return view('admin.reports.activity-log', [
            'items' => $payload['adminActivityItems'],
            'totals' => $payload['totals'],
            'filters' => $payload['filters'],
            'periodLabel' => $periodLabel,
            'generatedAt' => CarbonImmutable::now()->format('j F Y H:i'),
        ]);
    }

    public function logActivityExport(
        Request $request,
        AdminDashboardService $dashboardService,
    ): JsonResponse {
        $validated = $request->validate([
            'format' => ['required', Rule::in(['Excel', 'PDF', 'excel', 'pdf'])],
            'period' => ['nullable', Rule::in(['week', 'month', 'year'])],
            'item_count' => ['nullable', 'integer', 'min:0'],
        ]);

        $period = $validated['period'] ?? 'month';
        $periodLabels = [
            'week' => 'Mingguan',
            'month' => 'Bulanan',
            'year' => 'Tahunan',
        ];
        $format = strtoupper((string) $validated['format']) === 'PDF' ? 'PDF' : 'Excel';

        $dashboardService->logReportExport(
            $request,
            $format,
            $periodLabels[$period],
            (int) ($validated['item_count'] ?? 0),
        );

        return response()->json([
            'message' => 'Export activity logged.',
        ]);
    }

    public function updateFeedbackReviewStatus(
        Request $request,
        MessageFeedback $feedback,
    ): JsonResponse {
        abort_unless($feedback->type === MessageFeedback::TYPE_DISLIKE, 404);

        $validated = $request->validate([
            'status' => ['required', Rule::in([
                MessageFeedback::REVIEW_STATUS_OPEN,
                MessageFeedback::REVIEW_STATUS_REVIEWING,
                MessageFeedback::REVIEW_STATUS_RESOLVED,
                MessageFeedback::REVIEW_STATUS_IGNORED,
            ])],
        ]);

        $feedback->forceFill([
            'review_status' => $validated['status'],
            'reviewed_at' => in_array($validated['status'], [
                MessageFeedback::REVIEW_STATUS_RESOLVED,
                MessageFeedback::REVIEW_STATUS_IGNORED,
            ], true)
                ? now()
                : null,
        ])->save();

        return response()->json([
            'data' => [
                'id' => $feedback->id,
                'status' => $feedback->review_status,
            ],
        ]);
    }

    public function solveFeedbackReview(
        Request $request,
        MessageFeedback $feedback,
        FeedbackImprovementService $feedbackImprovementService,
    ): JsonResponse {
        abort_unless($feedback->type === MessageFeedback::TYPE_DISLIKE, 404);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
            'improvement' => ['nullable', 'string', 'max:4000'],
        ]);

        $manualImprovement = isset($validated['improvement'])
            ? trim((string) $validated['improvement'])
            : '';
        $improvement = $manualImprovement !== ''
            ? [
                'improvement' => $manualImprovement,
                'metadata' => [
                    'source' => 'admin_manual',
                    'edited_at' => now()->toIso8601String(),
                ],
            ]
            : $feedbackImprovementService->generate($feedback);

        $feedback->forceFill([
            'review_status' => MessageFeedback::REVIEW_STATUS_RESOLVED,
            'reviewed_at' => now(),
            'admin_decision' => MessageFeedback::ADMIN_DECISION_SOLVE,
            'admin_note' => $validated['note'] ?? null,
            'ai_improvement' => $improvement['improvement'],
            'ai_improvement_metadata' => $improvement['metadata'],
            'solved_by_user_id' => $request->user()?->id,
        ])->save();

        return response()->json([
            'data' => $this->feedbackReviewPayload($feedback),
        ]);
    }

    public function updateFeedbackImprovement(
        Request $request,
        MessageFeedback $feedback,
    ): JsonResponse {
        abort_unless($feedback->type === MessageFeedback::TYPE_DISLIKE, 404);

        $validated = $request->validate([
            'improvement' => ['required', 'string', 'max:4000'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $feedback->forceFill([
            'review_status' => MessageFeedback::REVIEW_STATUS_RESOLVED,
            'reviewed_at' => now(),
            'admin_decision' => MessageFeedback::ADMIN_DECISION_SOLVE,
            'admin_note' => $validated['note'] ?? $feedback->admin_note,
            'ai_improvement' => trim($validated['improvement']),
            'ai_improvement_metadata' => [
                'source' => 'admin_manual',
                'edited_at' => now()->toIso8601String(),
            ],
            'solved_by_user_id' => $request->user()?->id,
        ])->save();

        return response()->json([
            'data' => $this->feedbackReviewPayload($feedback),
        ]);
    }

    public function ignoreFeedbackReview(
        Request $request,
        MessageFeedback $feedback,
    ): JsonResponse {
        abort_unless($feedback->type === MessageFeedback::TYPE_DISLIKE, 404);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $feedback->forceFill([
            'review_status' => MessageFeedback::REVIEW_STATUS_IGNORED,
            'reviewed_at' => now(),
            'admin_decision' => MessageFeedback::ADMIN_DECISION_IGNORE,
            'admin_note' => $validated['note'] ?? null,
            'solved_by_user_id' => $request->user()?->id,
        ])->save();

        return response()->json([
            'data' => $this->feedbackReviewPayload($feedback),
        ]);
    }

    public function rollbackFeedbackReview(
        Request $request,
        MessageFeedback $feedback,
    ): JsonResponse {
        abort_unless($feedback->type === MessageFeedback::TYPE_DISLIKE, 404);

        $feedback->forceFill([
            'review_status' => MessageFeedback::REVIEW_STATUS_OPEN,
            'reviewed_at' => null,
            'admin_decision' => null,
            'admin_note' => null,
            'ai_improvement' => null,
            'ai_improvement_metadata' => null,
            'solved_by_user_id' => null,
        ])->save();

        return response()->json([
            'data' => $this->feedbackReviewPayload($feedback),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function feedbackReviewPayload(MessageFeedback $feedback): array
    {
        return [
            'id' => $feedback->id,
            'status' => $feedback->review_status,
            'adminDecision' => $feedback->admin_decision,
            'adminNote' => $feedback->admin_note,
            'aiImprovement' => $feedback->ai_improvement,
        ];
    }
}
