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

class ConversationMessageController extends Controller
{
    public function store(
        Request $request,
        Conversation $conversation,
        ConversationChatService $conversationChatService,
    ): JsonResponse {
        abort_unless($conversation->user->is($request->user()), 404);

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
                'required',
                'string',
                'max:4000',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (trim((string) $value) === '') {
                        $fail('The content field must not be empty.');
                    }
                },
            ],
        ]);

        try {
            [$userMessage, $assistantMessage] = $conversationChatService->sendMessage(
                $conversation,
                $request->user(),
                trim($validated['content']),
                idempotencyKey: $this->idempotencyKey($request),
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
