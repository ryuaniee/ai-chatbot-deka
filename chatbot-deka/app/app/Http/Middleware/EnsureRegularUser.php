<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRegularUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (($user !== null) && $user->isAdmin()) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'message' => 'Admin users cannot access the chat user area.',
                    'code' => 'ADMIN_ACCESS_DENIED',
                ], 403);
            }

            return redirect('/admin');
        }

        return $next($request);
    }
}
