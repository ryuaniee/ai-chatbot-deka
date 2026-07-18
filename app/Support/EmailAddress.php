<?php

namespace App\Support;

use Illuminate\Support\Str;

class EmailAddress
{
    public static function normalize(string $email): string
    {
        return Str::lower(trim($email));
    }

    public static function canonical(string $email): string
    {
        $email = self::normalize($email);

        if (! str_contains($email, '@')) {
            return $email;
        }

        [$local, $domain] = explode('@', $email, 2);
        $domain = $domain === 'googlemail.com' ? 'gmail.com' : $domain;

        $plusPosition = strpos($local, '+');

        if ($plusPosition !== false) {
            $local = substr($local, 0, $plusPosition);
        }

        if ($domain === 'gmail.com') {
            $local = str_replace('.', '', $local);
        }

        return $local.'@'.$domain;
    }
}
