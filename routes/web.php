<?php

use App\Http\Controllers\AuthApiController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\ConversationMessageController;
use App\Http\Controllers\ConversationStreamController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\PasswordResetLinkController;
use App\Http\Controllers\PublicEmailVerificationController;
use App\Http\Controllers\VerificationNotificationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::inertia('/', 'welcome')->name('home');
Route::redirect('dashboard', '/chat')->name('dashboard');
Route::redirect('admin', '/admin/overview')->name('admin');
Route::get('admin/{section}', function (string $section) {
    abort_unless(in_array($section, [
        'overview',
        'conversations',
        'token-usage',
        'users',
        'activity-log',
    ], true), 404);

    return Inertia::render('admin', [
        'section' => $section,
    ]);
})
    ->middleware(['auth', 'verified'])
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
    });
});

require __DIR__.'/settings.php';
