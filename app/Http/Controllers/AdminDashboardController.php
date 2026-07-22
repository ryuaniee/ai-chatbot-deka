<?php

namespace App\Http\Controllers;

use App\Models\MessageFeedback;
use App\Services\AdminDashboardService;
use App\Services\FeedbackImprovementService;
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
        'token-usage',
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
        $period = $payload['filters']['period'] ?? 'month';
        $periodLabels = [
            'week' => 'Mingguan',
            'month' => 'Bulanan',
            'year' => 'Tahunan',
        ];

        return view('admin.reports.activity-log', [
            'items' => $payload['adminActivityItems'],
            'totals' => $payload['totals'],
            'filters' => $payload['filters'],
            'periodLabel' => $periodLabels[$period] ?? $periodLabels['month'],
            'generatedAt' => now()->locale('id')->translatedFormat('j F Y H:i'),
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
        ]);

        $improvement = $feedbackImprovementService->generate($feedback);

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
