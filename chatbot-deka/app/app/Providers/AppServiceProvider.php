<?php

namespace App\Providers;

use App\Models\User;
use App\Notifications\WelcomeNotification;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;
use Illuminate\Http\Request;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
        $this->configureMailTemplates();
        $this->configureEventListeners();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('chat', function (Request $request): Limit {
            $user = $request->user();
            $key = $user !== null
                ? sprintf('chat:%s:%s', $user->getAuthIdentifier(), $request->ip())
                : sprintf('chat:guest:%s', $request->ip());

            return Limit::perMinute((int) config('services.ai_service.rate_limit_per_minute', 20))
                ->by($key);
        });
    }

    protected function configureMailTemplates(): void
    {
        VerifyEmail::createUrlUsing(function (object $notifiable): string {
            return URL::temporarySignedRoute(
                'verification.public.verify',
                now()->addMinutes(config('auth.verification.expire', 60)),
                [
                    'id' => $notifiable->getKey(),
                    'hash' => sha1($notifiable->getEmailForVerification()),
                ],
            );
        });

        VerifyEmail::toMailUsing(function (object $notifiable, string $url): MailMessage {
            return (new MailMessage)
                ->subject('Verifikasi Email Akun Chatbot Deka')
                ->view('emails.verify-email', [
                    'appName' => config('app.name', 'Chatbot Deka'),
                    'userName' => $notifiable->name,
                    'verificationUrl' => $url,
                    'expiryMinutes' => config('auth.verification.expire', 60),
                    'supportEmail' => config('mail.from.address'),
                    'logoUrl' => config('app.email_logo_url'),
                    'currentYear' => Carbon::now()->year,
                ]);
        });
    }

    protected function configureEventListeners(): void
    {
        Event::listen(Verified::class, function (Verified $event): void {
            $user = $event->user;

            if (! $user instanceof User || ! $user->isUser()) {
                return;
            }

            $user->notify(new WelcomeNotification());
        });
    }
}
