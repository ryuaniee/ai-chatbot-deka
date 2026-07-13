<?php

namespace App\Http\Controllers;

use App\Exceptions\AiServiceConfigurationException;
use App\Exceptions\AiServiceException;
use App\Exceptions\IdempotencyConflictException;
use App\Exceptions\ModerationException;
use App\Models\Conversation;
use App\Services\ConversationChatService;
use App\Support\ChatResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $conversations = $request->user()
            ->conversations()
            ->latest('last_message_at')
            ->latest('id')
            ->get()
            ->map(fn (Conversation $conversation): array => ChatResource::conversation($conversation))
            ->all();

        return response()->json([
            'data' => $conversations,
        ]);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->user->is($request->user()), 404);

        $conversation->load(['messages' => fn ($query) => $query->orderBy('sequence')]);

        return response()->json([
            'data' => ChatResource::conversation($conversation, withMessages: true),
        ]);
    }

    public function store(
        Request $request,
        ConversationChatService $conversationChatService,
    ): JsonResponse {
        $validated = $request->validate([
            'content' => ['nullable', 'string', 'max:4000'],
        ]);

        $content = trim((string) ($validated['content'] ?? ''));

        if ($content === '') {
            $conversation = $request->user()->conversations()->create([
                'status' => 'active',
            ]);

            return response()->json([
                'data' => ChatResource::conversation($conversation),
            ], 201);
        }

        try {
            [$conversation, $userMessage, $assistantMessage] = $conversationChatService->startConversation(
                $request->user(),
                $content,
                $this->idempotencyKey($request),
            );
        } catch (IdempotencyConflictException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'IDEMPOTENCY_KEY_REUSED',
            ], 409);
        } catch (ModerationException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->reasonCode,
            ], 422);
        } catch (AiServiceConfigurationException $exception) {
            return response()->json([
                'message' => 'Assistant service is temporarily unavailable.',
                'code' => 'AI_SERVICE_MISCONFIGURED',
            ], 503);
        } catch (AiServiceException $exception) {
            return response()->json([
                'message' => 'Assistant response could not be generated.',
                'code' => 'AI_SERVICE_UNAVAILABLE',
            ], 502);
        }

        $conversation->refresh();

        return response()->json([
            'conversation' => ChatResource::conversation($conversation),
            'user_message' => ChatResource::message($userMessage),
            'assistant_message' => ChatResource::message($assistantMessage),
        ], 201);
    }

    private function idempotencyKey(Request $request): ?string
    {
        $key = trim((string) $request->header('Idempotency-Key'));

        return $key !== '' ? $key : null;
    }
}
