<?php

namespace App\Providers;

use App\Models\User;
use App\Notifications\WelcomeNotification;
use Carbon\CarbonImmutable;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\DevCommands;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Psr\Http\Message\RequestInterface;

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
        $this->configureDevCommands();
        $this->configureAntigravityGeminiCompat();
        $this->configureRateLimiting();
        $this->configureMailTemplates();
        $this->configureEventListeners();
    }

    /**
     * Antigravity Gemini proxy expects camelCase systemInstruction.
     * Laravel AI SDK sends snake_case system_instruction, which returns HTTP 400.
     */
    protected function configureAntigravityGeminiCompat(): void
    {
        Http::globalRequestMiddleware(function (RequestInterface $request): RequestInterface {
            $url = (string) $request->getUri();

            if (! str_contains($url, 'codex.deka.dev/antigravity') && ! str_contains($url, '/antigravity/')) {
                return $request;
            }

            $body = $request->getBody();
            $rawBody = (string) $body;

            if ($body->isSeekable()) {
                $body->rewind();
            }

            if ($rawBody === '') {
                return $request;
            }

            $data = json_decode($rawBody, true);

            if (! is_array($data)) {
                return $request;
            }

            if (! array_key_exists('system_instruction', $data)) {
                return $request;
            }

            $data['systemInstruction'] = $data['system_instruction'];
            unset($data['system_instruction']);

            $encoded = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            return $request
                ->withoutHeader('Content-Length')
                ->withBody(Utils::streamFor($encoded));
        });
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

    protected function configureDevCommands(): void
    {
        if (! app()->runningInConsole()) {
            return;
        }

        $port = parse_url((string) config('app.url'), PHP_URL_PORT) ?: 8000;

        DevCommands::artisan("serve --host=0.0.0.0 --port={$port}", 'server');
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('chat', function (Request $request): Limit {
            $user = $request->user();
            $key = $user !== null
                ? sprintf('chat:%s:%s', $user->getAuthIdentifier(), $request->ip())
                : sprintf('chat:guest:%s', $request->ip());

            return Limit::perMinute((int) config('services.ai_chat.rate_limit_per_minute', 20))
                ->by($key);
        });
    }

    protected function configureMailTemplates(): void
    {
        VerifyEmail::createUrlUsing(function (User $notifiable): string {
            return URL::temporarySignedRoute(
                'verification.public.verify',
                now()->addMinutes(config('auth.verification.expire', 60)),
                [
                    'id' => $notifiable->getKey(),
                    'hash' => sha1($notifiable->getEmailForVerification()),
                ],
            );
        });

        VerifyEmail::toMailUsing(function (User $notifiable, string $url): MailMessage {
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

            $user->notify(new WelcomeNotification);
        });
    }
}
