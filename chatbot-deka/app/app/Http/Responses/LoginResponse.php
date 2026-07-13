<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\ResolvesAuthRedirect;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;

class LoginResponse implements LoginResponseContract
{
    use ResolvesAuthRedirect;

    public function toResponse($request)
    {
        return $request->wantsJson()
            ? response()->json(['two_factor' => false])
            : redirect()->to($this->redirectPathFor($request));
    }
}
