<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeNotification extends Notification
{
    use Queueable;

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
            ->subject('Selamat Datang di Chatbot Deka')
            ->view('emails.welcome', [
                'appName' => config('app.name', 'Chatbot Deka'),
                'userName' => $notifiable->name,
                'chatUrl' => url('/chat'),
                'supportEmail' => config('mail.from.address'),
                'logoUrl' => config('app.email_logo_url'),
                'currentYear' => now()->year,
            ]);
    }
}
