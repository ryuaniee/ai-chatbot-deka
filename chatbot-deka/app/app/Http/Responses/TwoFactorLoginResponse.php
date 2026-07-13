<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\ResolvesAuthRedirect;
use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse as TwoFactorLoginResponseContract;

class TwoFactorLoginResponse implements TwoFactorLoginResponseContract
{
    use ResolvesAuthRedirect;

    public function toResponse($request)
    {
        return $request->wantsJson()
            ? new JsonResponse('', 204)
            : redirect()->to($this->redirectPathFor($request));
    }
}
