<?php

namespace App\Http\Responses;

use App\Http\Responses\Concerns\ResolvesAuthRedirect;
use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;

class RegisterResponse implements RegisterResponseContract
{
    use ResolvesAuthRedirect;

    public function toResponse($request)
    {
        return $request->wantsJson()
            ? new JsonResponse('', 201)
            : redirect()->to($this->redirectPathFor($request));
    }
}
