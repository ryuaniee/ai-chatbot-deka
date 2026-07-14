<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
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
