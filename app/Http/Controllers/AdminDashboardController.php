<?php

namespace App\Http\Controllers;

use App\Services\AdminDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    private const SECTIONS = [
        'overview',
        'token-usage',
        'users',
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
}
