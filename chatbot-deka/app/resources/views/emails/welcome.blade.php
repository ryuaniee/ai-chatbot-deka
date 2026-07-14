<!DOCTYPE html>
<html lang="id">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome</title>
    </head>
    <body style="margin: 0; padding: 32px 16px; background-color: #f5f7fa; font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 0;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #d9e2ec; border-radius: 16px; border-collapse: collapse; overflow: hidden;">
                                    <tr>
                                        <td style="padding: 24px 32px 18px; border-top: 5px solid #1d4ed8; border-bottom: 1px solid #e5e7eb;">
                                            @if (!empty($logoUrl))
                                                <img src="{{ $logoUrl }}" alt="{{ $appName }}" style="display: block; height: 150px; width: auto; margin: 0 auto 20px;">
                                            @endif
                                            <div style="text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8;">
                                                {{ $appName }}
                                            </div>
                                            <h1 style="margin: 14px 0 8px; text-align: center; font-size: 28px; line-height: 1.25; color: #111827;">
                                                Selamat datang di {{ $appName }}
                                            </h1>
                                            <p style="margin: 0; text-align: center; font-size: 15px; line-height: 1.7; color: #4b5563;">
                                                Akun Anda telah aktif dan siap digunakan.
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 32px;">
                                            <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.75;">
                                                Halo {{ $userName }},
                                            </p>
                                            <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.75; color: #374151;">
                                                Email Anda telah berhasil diverifikasi. Anda kini dapat mulai menggunakan {{ $appName }} untuk memperoleh informasi seputar Deka secara lebih cepat dan terarah.
                                            </p>
                                            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0 24px; border-collapse: collapse;">
                                                <tr>
                                                    <td align="center" bgcolor="#1d4ed8" style="border-radius: 10px;">
                                                        <a href="{{ $chatUrl }}" style="display: inline-block; padding: 14px 24px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none;">
                                                            Buka Chat
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.7; color: #4b5563;">
                                                Anda dapat menggunakan chatbot untuk mengenal profil Deka, layanan yang tersedia, serta informasi kontak yang relevan.
                                            </p>
                                            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #4b5563;">
                                                Untuk bantuan lebih lanjut, silakan hubungi <a href="mailto:{{ $supportEmail }}" style="color: #1d4ed8; text-decoration: none;">{{ $supportEmail }}</a>.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin: 16px 0 0; text-align: center; font-size: 12px; line-height: 1.6; color: #6b7280;">
                                    &copy; {{ $currentYear }} {{ $appName }}. Semua hak dilindungi.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
