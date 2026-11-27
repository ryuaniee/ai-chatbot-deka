<?php

namespace App\Http\Controllers;

use App\Exceptions\AiRuntimeConfigurationException;
use App\Exceptions\AiRuntimeException;
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

    public function update(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->user->is($request->user()), 404);

        $validated = $request->validate([
            'title' => ['required', 'string', 'min:1', 'max:120'],
        ]);

        $title = trim($validated['title']);

        if ($title === '') {
            return response()->json([
                'message' => 'The title field must not be empty.',
                'errors' => [
                    'title' => ['The title field must not be empty.'],
                ],
            ], 422);
        }

        $conversation->forceFill([
            'title' => $title,
        ])->save();

        return response()->json([
            'message' => 'Conversation updated.',
            'data' => ChatResource::conversation($conversation->fresh()),
        ]);
    }

    public function destroy(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->user->is($request->user()), 404);

        $conversation->delete();

        return response()->json([
            'message' => 'Conversation deleted.',
            'data' => [
                'id' => $conversation->id,
            ],
        ]);
    }

    public function store(
        Request $request,
        ConversationChatService $conversationChatService,
    ): JsonResponse {
        if ($this->contentWasSubmittedAsBlankString($request)) {
            return response()->json([
                'message' => 'The content field must not be empty.',
                'errors' => [
                    'content' => ['The content field must not be empty.'],
                ],
            ], 422);
        }

        $validated = $request->validate([
            'content' => [
                'nullable',
                'string',
                'max:4000',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value !== null && trim((string) $value) === '') {
                        $fail('The content field must not be empty.');
                    }
                },
            ],
        ]);

        $content = array_key_exists('content', $validated)
            ? trim((string) $validated['content'])
            : null;

        if ($content === null) {
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
        } catch (AiRuntimeConfigurationException $exception) {
            return response()->json([
                'message' => 'Assistant runtime is temporarily unavailable.',
                'code' => 'AI_RUNTIME_MISCONFIGURED',
            ], 503);
        } catch (AiRuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode ?? 'AI_RUNTIME_UNAVAILABLE',
            ], $exception->status);
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

    private function contentWasSubmittedAsBlankString(Request $request): bool
    {
        if (! $request->isJson()) {
            return false;
        }

        $payload = json_decode($request->getContent(), true);

        return is_array($payload)
            && array_key_exists('content', $payload)
            && is_string($payload['content'])
            && trim($payload['content']) === '';
    }
}
