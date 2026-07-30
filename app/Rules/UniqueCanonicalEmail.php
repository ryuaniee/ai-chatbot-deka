<?php

namespace App\Rules;

use App\Models\User;
use App\Support\EmailAddress;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class UniqueCanonicalEmail implements ValidationRule
{
    public function __construct(
        private readonly ?int $ignoreUserId = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $exists = User::query()
            ->where('canonical_email', EmailAddress::canonical((string) $value))
            ->when($this->ignoreUserId !== null, fn ($query) => $query->whereKeyNot($this->ignoreUserId))
            ->exists();

        if ($exists) {
            $fail(__('The email has already been taken.'));
        }
    }
}
