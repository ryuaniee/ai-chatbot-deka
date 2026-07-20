<?php

namespace App\Http\Controllers;

use App\Models\MessageFeedback;
use App\Services\AdminDashboardService;
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
            ])],
        ]);

        $feedback->forceFill([
            'review_status' => $validated['status'],
            'reviewed_at' => $validated['status'] === MessageFeedback::REVIEW_STATUS_RESOLVED
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
}
