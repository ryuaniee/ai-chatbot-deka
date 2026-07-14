<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $token,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
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
