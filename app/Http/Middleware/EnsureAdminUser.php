<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (($user !== null) && ! $user->isAdmin()) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'message' => 'Only admin users can access the admin area.',
                    'code' => 'ADMIN_AREA_ACCESS_DENIED',
                ], 403);
            }

            return redirect('/chat');
        }

        return $next($request);
    }
}
