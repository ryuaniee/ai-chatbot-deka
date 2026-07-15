<?php

namespace App\Http\Controllers;

use App\Exceptions\AiRuntimeConfigurationException;
use App\Exceptions\AiRuntimeException;
use App\Exceptions\IdempotencyConflictException;
use App\Exceptions\ModerationException;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\ConversationChatService;
use App\Support\ChatResource;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Ai\Responses\StreamableAgentResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ConversationStreamController extends Controller
{
    public function store(
        Request $request,
        ConversationChatService $conversationChatService,
    ): JsonResponse|StreamedResponse {
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
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (trim((string) $value) === '') {
                        $fail('The content field must not be empty.');
                    }
                },
            ],
        ]);

        try {
            $result = $conversationChatService->startConversationStream(
                $request->user(),
                trim($validated['content']),
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

        return $this->streamResponse($result);
    }

    public function message(
        Request $request,
        Conversation $conversation,
        ConversationChatService $conversationChatService,
    ): JsonResponse|StreamedResponse {
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
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (trim((string) $value) === '') {
                        $fail('The content field must not be empty.');
                    }
                },
            ],
        ]);

        try {
            $result = $conversationChatService->sendMessageStream(
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

        return $this->streamResponse($result);
    }

    /**
     * @param  array{
     *     conversation: Conversation,
     *     user_message: Message,
     *     assistant_message: Message|null,
     *     stream: StreamableAgentResponse|null,
     *     state: object
     * }  $result
     */
    private function streamResponse(array $result): StreamedResponse
    {
        return response()->stream(function () use ($result): void {
            $this->prepareStreamOutput();

            $conversation = $result['conversation'];
            $userMessage = $result['user_message'];
            $assistantMessage = $result['assistant_message'];
            $stream = $result['stream'];
            $state = $result['state'];

            echo ": stream-start\n\n";
            flush();

            $this->emitEvent([
                'type' => 'conversation_started',
                'conversation' => ChatResource::conversation($conversation->fresh()),
                'user_message' => ChatResource::message($userMessage->fresh()),
            ]);

            if ($stream !== null) {
                try {
                    foreach ($stream as $event) {
                        $payload = $event->toArray();

                        if (($payload['type'] ?? null) !== 'text_delta') {
                            continue;
                        }

                        $this->emitEvent([
                            'type' => 'text_delta',
                            'delta' => (string) ($payload['delta'] ?? ''),
                        ]);
                    }
                } catch (Throwable $exception) {
                    $this->emitEvent([
                        'type' => 'error',
                        'message' => $exception->getMessage(),
                        'code' => 'AI_RUNTIME_UNAVAILABLE',
                    ]);

                    $this->emitDone();

                    return;
                }
            }

            if ($assistantMessage === null && isset($state->assistantMessage) && $state->assistantMessage !== null) {
                $assistantMessage = $state->assistantMessage->fresh();
            }

            $conversation = $conversation->fresh();

            if ($assistantMessage !== null) {
                $this->emitEvent([
                    'type' => 'message_complete',
                    'conversation' => ChatResource::conversation($conversation),
                    'assistant_message' => ChatResource::message($assistantMessage),
                ]);
            }

            $this->emitDone();
        }, 200, [
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'Content-Type' => 'text/event-stream',
            'Content-Encoding' => 'none',
            'Pragma' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function emitEvent(array $payload): void
    {
        echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n\n";

        if (function_exists('ob_flush')) {
            @ob_flush();
        }

        flush();
    }

    private function emitDone(): void
    {
        echo "data: [DONE]\n\n";

        if (function_exists('ob_flush')) {
            @ob_flush();
        }

        flush();
    }

    private function prepareStreamOutput(): void
    {
        if (function_exists('session_write_close')) {
            @session_write_close();
        }

        if (app()->runningUnitTests()) {
            return;
        }

        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', '1');
        }

        @ini_set('zlib.output_compression', '0');
        @ini_set('output_buffering', 'off');

        while (ob_get_level() > 0) {
            @ob_end_flush();
        }

        ob_implicit_flush(true);
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
