<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $token,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(User $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reset Password Akun Chatbot Deka')
            ->view('emails.reset-password', [
                'appName' => config('app.name', 'Chatbot Deka'),
                'userName' => $notifiable->name,
                'resetUrl' => route('password.reset', [
                    'token' => $this->token,
                    'email' => $notifiable->email,
                ]),
                'expiryMinutes' => config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60),
                'supportEmail' => config('mail.from.address'),
                'logoUrl' => config('app.email_logo_url'),
                'currentYear' => now()->year,
            ]);
    }
}
