<?php

use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminRoleController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthApiController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\ConversationMessageController;
use App\Http\Controllers\ConversationStreamController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\MessageFeedbackController;
use App\Http\Controllers\PasswordResetLinkController;
use App\Http\Controllers\PublicEmailVerificationController;
use App\Http\Controllers\VerificationNotificationController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');
Route::redirect('dashboard', '/chat')->name('dashboard');
Route::redirect('admin', '/admin/overview')
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin');
Route::redirect('admin/token-usage', '/admin/analytic')
    ->middleware(['auth', 'verified', 'admin-user']);
Route::get('admin/activity-log/items', [AdminDashboardController::class, 'activityLogItems'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.activity-log.items');
Route::get('admin/activity-log/report', [AdminDashboardController::class, 'activityLogReport'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.activity-log.report');
Route::post('admin/activity-log/export-log', [AdminDashboardController::class, 'logActivityExport'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.activity-log.export-log');
Route::patch('admin/feedback-review/{feedback}/status', [AdminDashboardController::class, 'updateFeedbackReviewStatus'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.feedback-review.status');
Route::post('admin/feedback-review/{feedback}/solve', [AdminDashboardController::class, 'solveFeedbackReview'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.feedback-review.solve');
Route::post('admin/feedback-review/{feedback}/ignore', [AdminDashboardController::class, 'ignoreFeedbackReview'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.feedback-review.ignore');
Route::patch('admin/feedback-review/{feedback}/improvement', [AdminDashboardController::class, 'updateFeedbackImprovement'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.feedback-review.improvement');
Route::post('admin/feedback-review/{feedback}/rollback', [AdminDashboardController::class, 'rollbackFeedbackReview'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.feedback-review.rollback');
Route::post('admin/users', [AdminUserController::class, 'store'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.users.store');
Route::put('admin/users/{user}', [AdminUserController::class, 'update'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.users.update');
Route::delete('admin/users/{user}', [AdminUserController::class, 'destroy'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.users.destroy');
Route::post('admin/roles', [AdminRoleController::class, 'store'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.roles.store');
Route::put('admin/roles/{role}', [AdminRoleController::class, 'update'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.roles.update');
Route::delete('admin/roles/{role}', [AdminRoleController::class, 'destroy'])
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.roles.destroy');
Route::get('admin/{section}', AdminDashboardController::class)
    ->middleware(['auth', 'verified', 'admin-user'])
    ->name('admin.section');

Route::prefix('api/auth')->name('api.auth.')->group(function () {
    Route::get('csrf', [AuthApiController::class, 'csrf'])
        ->name('csrf');

    Route::middleware('guest')->group(function () {
        Route::post('register', [AuthApiController::class, 'register'])
            ->middleware('throttle:6,1')
            ->name('register');
        Route::post('login', [AuthApiController::class, 'login'])
            ->middleware('throttle:login')
            ->name('login');
    });

    Route::middleware('auth')->group(function () {
        Route::get('me', [AuthApiController::class, 'me'])
            ->name('me');
        Route::post('logout', [AuthApiController::class, 'logout'])
            ->name('logout');
    });
});

Route::middleware('guest')->group(function () {
    Route::get('auth/google', [GoogleAuthController::class, 'redirect'])
        ->name('auth.google.redirect');
    Route::get('auth/google/callback', [GoogleAuthController::class, 'callback'])
        ->name('auth.google.callback');
});

Route::post('email/verification-notification-resend', [VerificationNotificationController::class, 'store'])
    ->middleware(['auth'])
    ->name('verification.resend');

Route::get('email/verify/{id}/{hash}', PublicEmailVerificationController::class)
    ->middleware(['signed', 'throttle:6,1'])
    ->name('verification.public.verify');

Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])
    ->middleware('guest')
    ->name('password.email');

Route::middleware(['auth', 'verified', 'regular-user'])->group(function () {
    Route::inertia('chat', 'chat')->name('chat');

    Route::prefix('api')->name('api.')->group(function () {
        Route::get('conversations', [ConversationController::class, 'index'])
            ->name('conversations.index');
        Route::post('conversations', [ConversationController::class, 'store'])
            ->middleware('throttle:chat')
            ->name('conversations.store');
        Route::post('conversations/stream', [ConversationStreamController::class, 'store'])
            ->middleware('throttle:chat')
            ->name('conversations.stream');
        Route::get('conversations/{conversation}', [ConversationController::class, 'show'])
            ->name('conversations.show');
        Route::patch('conversations/{conversation}', [ConversationController::class, 'update'])
            ->name('conversations.update');
        Route::delete('conversations/{conversation}', [ConversationController::class, 'destroy'])
            ->name('conversations.destroy');
        Route::post(
            'conversations/{conversation}/messages',
            [ConversationMessageController::class, 'store'],
        )->middleware('throttle:chat')
            ->name('conversations.messages.store');
        Route::post(
            'conversations/{conversation}/messages/stream',
            [ConversationStreamController::class, 'message'],
        )->middleware('throttle:chat')
            ->name('conversations.messages.stream');
        Route::post(
            'conversations/{conversation}/messages/{message}/feedback',
            [MessageFeedbackController::class, 'store'],
        )->name('conversations.messages.feedback');
    });
});

require __DIR__.'/settings.php';
