<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageFeedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MessageFeedbackController extends Controller
{
    public function store(
        Request $request,
        Conversation $conversation,
        Message $message,
    ): JsonResponse {
        abort_unless($conversation->user->is($request->user()), 404);
        abort_unless($message->conversation_id === $conversation->id, 404);
        abort_unless($message->role === 'assistant', 422);

        $validated = $request->validate([
            'type' => ['nullable', Rule::in([
                MessageFeedback::TYPE_LIKE,
                MessageFeedback::TYPE_DISLIKE,
            ])],
        ]);

        $type = $validated['type'] ?? null;

        if ($type === null) {
            MessageFeedback::query()
                ->where('message_id', $message->id)
                ->where('user_id', $request->user()->id)
                ->delete();
        } else {
            MessageFeedback::query()->updateOrCreate(
                [
                    'message_id' => $message->id,
                    'user_id' => $request->user()->id,
                ],
                ['type' => $type],
            );
        }

        return response()->json([
            'data' => [
                'message_id' => $message->id,
                'type' => $type,
            ],
        ]);
    }
}
