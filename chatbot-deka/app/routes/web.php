<?php

use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');
Route::redirect('dashboard', '/chat')->name('dashboard');

Route::prefix('api/auth')->name('api.auth.')->group(function () {
    Route::get('csrf', [\App\Http\Controllers\AuthApiController::class, 'csrf'])
        ->name('csrf');

    Route::middleware('guest')->group(function () {
        Route::post('register', [\App\Http\Controllers\AuthApiController::class, 'register'])
            ->middleware('throttle:6,1')
            ->name('register');
        Route::post('login', [\App\Http\Controllers\AuthApiController::class, 'login'])
            ->middleware('throttle:login')
            ->name('login');
    });

    Route::middleware('auth')->group(function () {
        Route::get('me', [\App\Http\Controllers\AuthApiController::class, 'me'])
            ->name('me');
        Route::post('logout', [\App\Http\Controllers\AuthApiController::class, 'logout'])
            ->name('logout');
    });
});

Route::middleware('guest')->group(function () {
    Route::get('auth/google', [\App\Http\Controllers\GoogleAuthController::class, 'redirect'])
        ->name('auth.google.redirect');
    Route::get('auth/google/callback', [\App\Http\Controllers\GoogleAuthController::class, 'callback'])
        ->name('auth.google.callback');
});

Route::post('email/verification-notification-resend', [\App\Http\Controllers\VerificationNotificationController::class, 'store'])
    ->middleware(['auth'])
    ->name('verification.resend');

Route::get('email/verify/{id}/{hash}', \App\Http\Controllers\PublicEmailVerificationController::class)
    ->middleware(['signed', 'throttle:6,1'])
    ->name('verification.public.verify');

Route::post('forgot-password', [\App\Http\Controllers\PasswordResetLinkController::class, 'store'])
    ->middleware('guest')
    ->name('password.email');

Route::middleware(['auth', 'verified', 'regular-user'])->group(function () {
    Route::inertia('chat', 'chat')->name('chat');

    Route::prefix('api')->name('api.')->group(function () {
        Route::get('conversations', [\App\Http\Controllers\ConversationController::class, 'index'])
            ->name('conversations.index');
        Route::post('conversations', [\App\Http\Controllers\ConversationController::class, 'store'])
            ->middleware('throttle:chat')
            ->name('conversations.store');
        Route::get('conversations/{conversation}', [\App\Http\Controllers\ConversationController::class, 'show'])
            ->name('conversations.show');
        Route::post(
            'conversations/{conversation}/messages',
            [\App\Http\Controllers\ConversationMessageController::class, 'store'],
        )->middleware('throttle:chat')
            ->name('conversations.messages.store');
    });
});

require __DIR__.'/settings.php';
