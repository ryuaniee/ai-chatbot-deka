import { Head, useHttp, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    HelpCircle,
    History,
    Info,
    MessageSquare,
    Phone,
    Plus,
    SendHorizontal,
    Sidebar,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DekaLogo from '@/components/deka-logo';
import LogoutConfirmModal from '@/components/logout-confirm-modal';
import SettingsModal from '@/components/settings-modal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import {
    index as getConversations,
    show as getConversation,
} from '@/routes/api/conversations';

interface ConversationItem {
    id: number;
    title: string;
    status: string;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
}

interface MessageItem {
    id: number;
    conversation_id: number;
    reply_to_message_id: number | null;
    role: 'user' | 'assistant';
    content: string;
    sequence: number;
    created_at: string;
    response_time_ms?: number | null;
    first_delta_at_ms?: number | null;
    delta_count?: number | null;
}

interface StreamMetrics {
    delta_count: number;
    first_delta_at_ms: number | null;
    stream_duration_ms: number;
}

interface StreamEventPayload {
    type: 'conversation_started' | 'text_delta' | 'message_complete' | 'error';
    conversation?: ConversationItem;
    user_message?: MessageItem;
    assistant_message?: MessageItem;
    stream_metrics?: StreamMetrics;
    delta?: string;
    message?: string;
}

type StreamRequest = {
    conversationId: number | null;
    text: string;
    tempUserMessage: MessageItem;
};

type ConversationGroup = {
    label: string;
    conversations: ConversationItem[];
};

const dayKey = (date: Date): string =>
    [date.getFullYear(), date.getMonth(), date.getDate()].join('-');

const getConversationTimestamp = (conversation: ConversationItem): Date =>
    new Date(
        conversation.last_message_at ??
            conversation.updated_at ??
            conversation.created_at,
    );

const groupConversationsByRecency = (
    items: ConversationItem[],
): ConversationGroup[] => {
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    const groups: Record<string, ConversationItem[]> = {
        'Hari ini': [],
        Kemarin: [],
        Sebelumnya: [],
    };

    items.forEach((conversation) => {
        const date = getConversationTimestamp(conversation);
        const label =
            dayKey(date) === dayKey(today)
                ? 'Hari ini'
                : dayKey(date) === dayKey(yesterday)
                  ? 'Kemarin'
                  : 'Sebelumnya';

        groups[label].push(conversation);
    });

    return Object.entries(groups)
        .filter(([, conversations]) => conversations.length > 0)
        .map(([label, conversations]) => ({ label, conversations }));
};

const formatDuration = (
    milliseconds: number | null | undefined,
): string | null => {
    if (milliseconds === null || milliseconds === undefined) {
        return null;
    }

    if (milliseconds < 1000) {
        return `${Math.round(milliseconds)} ms`;
    }

    return `${(milliseconds / 1000).toFixed(1)} dtk`;
};

export default function ChatPage() {
    const { auth } = usePage().props;
    const { submit } = useHttp();

    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<
        number | null
    >(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= 1024,
    );
    const [historyOpen, setHistoryOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [msgFeedback, setMsgFeedback] = useState<
        Record<string | number, 'like' | 'dislike'>
    >(() => {
        try {
            const saved = localStorage.getItem('deka_chat_feedback');

            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const handleToggleFeedback = (
        messageId: string | number,
        type: 'like' | 'dislike',
    ) => {
        setMsgFeedback((prev) => {
            const next = { ...prev };

            if (next[messageId] === type) {
                delete next[messageId];
            } else {
                next[messageId] = type;
            }

            localStorage.setItem('deka_chat_feedback', JSON.stringify(next));

            return next;
        });
    };

    const getFollowUpSuggestions = (lastMessageContent: string) => {
        const content = lastMessageContent.toLowerCase();

        if (
            content.includes('alamat') ||
            content.includes('lokasi') ||
            content.includes('dimana')
        ) {
            return [
                'Jam operasional Deka',
                'Bagaimana rute ke sana?',
                'Hubungi Deka',
            ];
        }

        if (
            content.includes('layanan') ||
            content.includes('produk') ||
            content.includes('menu')
        ) {
            return [
                'Harga layanan Deka',
                'Jam operasional Deka',
                'Kontak resmi Deka',
            ];
        }

        if (
            content.includes('fitur') ||
            content.includes('bantu') ||
            content.includes('bisa apa')
        ) {
            return ['Apa itu Deka?', 'Layanan Deka', 'Kontak & Alamat'];
        }

        return [
            'Hubungi Customer Service',
            'Menu Deka Coffee',
            'Tentang Deka Studio',
        ];
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const streamAbortRef = useRef<AbortController | null>(null);
    const nextTempIdRef = useRef(-1);

    const user = auth.user;
    const groupedConversations = groupConversationsByRecency(conversations);

    const fetchConversations = () => {
        submit(getConversations())
            .then((res: any) => {
                setConversations(res.data || []);
            })
            .catch((err) => {
                console.error('Failed to fetch conversations:', err);
            });
    };

    const nextTempId = () => {
        const id = nextTempIdRef.current;

        nextTempIdRef.current -= 1;

        return id;
    };

    useEffect(() => {
        submit(getConversations())
            .then((res: any) => {
                setConversations(res.data || []);
            })
            .catch((err) => {
                console.error('Failed to fetch conversations:', err);
            });
    }, [submit]);

    useEffect(
        () => () => {
            streamAbortRef.current?.abort();
        },
        [],
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    const handleSelectConversation = (id: number) => {
        streamAbortRef.current?.abort();
        setActiveConversationId(id);
        setIsGenerating(false);
        setSidebarOpen(false);
        submit(getConversation(id))
            .then((res: any) => {
                setMessages(res.data?.messages || []);
            })
            .catch((err) => {
                console.error('Failed to fetch conversation:', err);
            });
    };

    const handleNewChat = () => {
        streamAbortRef.current?.abort();
        setActiveConversationId(null);
        setMessages([]);
        setInputValue('');
        setIsGenerating(false);
        setSidebarOpen(false);
    };

    const handleSendMessage = async (customText?: string) => {
        const text = (customText || inputValue).trim();

        if (!text || isGenerating) {
            return;
        }

        if (!customText) {
            setInputValue('');
        }

        setIsGenerating(true);

        const tempUserMsg: MessageItem = {
            id: nextTempId(),
            conversation_id: activeConversationId ?? 0,
            reply_to_message_id: null,
            role: 'user',
            content: text,
            sequence: messages.length + 1,
            created_at: new Date().toISOString(),
        };

        if (activeConversationId === null) {
            setMessages([tempUserMsg]);
        } else {
            setMessages((prev) => [...prev, tempUserMsg]);
        }

        try {
            await streamChatResponse({
                conversationId: activeConversationId,
                text,
                tempUserMessage: tempUserMsg,
            });
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }

            let rolledBackTempUser = false;

            setMessages((prev) => {
                const next = prev.filter(
                    (message) => message.id !== tempUserMsg.id,
                );

                rolledBackTempUser = next.length !== prev.length;

                return next;
            });

            if (rolledBackTempUser) {
                setInputValue(text);
            }

            console.error('Failed to stream chat response:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const streamChatResponse = async ({
        conversationId,
        text,
        tempUserMessage,
    }: StreamRequest) => {
        streamAbortRef.current?.abort();

        const controller = new AbortController();
        streamAbortRef.current = controller;

        const csrfToken = document.querySelector<HTMLMetaElement>(
            'meta[name="csrf-token"]',
        )?.content;

        const url =
            conversationId === null
                ? '/api/conversations/stream'
                : `/api/conversations/${conversationId}/messages/stream`;

        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'text/event-stream',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken ?? '',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ content: text }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type') ?? '';

            if (contentType.includes('application/json')) {
                const payload = await response.json();

                throw new Error(payload.message ?? 'Request failed.');
            }

            throw new Error(await response.text());
        }

        if (response.body === null) {
            throw new Error('Stream body is unavailable.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const tempAssistantId = nextTempId();
        let buffer = '';
        let streamCompleted = false;

        const drainBufferedEvents = (source: string): string => {
            const normalized = source.replace(/\r\n/g, '\n');
            const chunks = normalized.split('\n\n');
            const remainder = chunks.pop() ?? '';

            for (const chunk of chunks) {
                const dataLines = chunk
                    .split('\n')
                    .filter((line) => line.startsWith('data: '))
                    .map((line) => line.slice(6));

                if (dataLines.length === 0) {
                    continue;
                }

                const payload = dataLines.join('\n');

                if (payload === '[DONE]') {
                    fetchConversations();
                    streamCompleted = true;

                    return '';
                }

                applyEvent(JSON.parse(payload) as StreamEventPayload);
            }

            return remainder;
        };

        const applyEvent = (event: StreamEventPayload) => {
            switch (event.type) {
                case 'conversation_started':
                    if (event.conversation) {
                        setActiveConversationId(event.conversation.id);
                    }

                    if (event.user_message) {
                        setMessages((prev) =>
                            prev.map((message) =>
                                message.id === tempUserMessage.id
                                    ? event.user_message!
                                    : message,
                            ),
                        );
                    }

                    break;

                case 'text_delta':
                    setMessages((prev) => {
                        const delta = event.delta ?? '';
                        const assistantIndex = prev.findIndex(
                            (message) => message.id === tempAssistantId,
                        );

                        if (assistantIndex === -1) {
                            const lastMessage = prev[prev.length - 1];

                            return [
                                ...prev,
                                {
                                    id: tempAssistantId,
                                    conversation_id:
                                        lastMessage?.conversation_id ?? 0,
                                    reply_to_message_id: null,
                                    role: 'assistant',
                                    content: delta,
                                    sequence: prev.length + 1,
                                    created_at: new Date().toISOString(),
                                },
                            ];
                        }

                        return prev.map((message) =>
                            message.id === tempAssistantId
                                ? {
                                      ...message,
                                      content: message.content + delta,
                                  }
                                : message,
                        );
                    });

                    break;

                case 'message_complete':
                    if (event.assistant_message) {
                        setMessages((prev) => {
                            const withoutTemp = prev.filter(
                                (message) => message.id !== tempAssistantId,
                            );

                            return [
                                ...withoutTemp,
                                {
                                    ...event.assistant_message!,
                                    response_time_ms:
                                        event.stream_metrics
                                            ?.stream_duration_ms ?? null,
                                    first_delta_at_ms:
                                        event.stream_metrics
                                            ?.first_delta_at_ms ?? null,
                                    delta_count:
                                        event.stream_metrics?.delta_count ??
                                        null,
                                },
                            ];
                        });
                    }

                    if (event.conversation) {
                        setConversations((prev) => {
                            const filtered = prev.filter(
                                (conversation) =>
                                    conversation.id !== event.conversation!.id,
                            );

                            return [event.conversation!, ...filtered];
                        });
                    } else {
                        fetchConversations();
                    }

                    break;

                case 'error':
                    setMessages((prev) =>
                        prev.filter(
                            (message) => message.id !== tempAssistantId,
                        ),
                    );

                    throw new Error(
                        event.message ?? 'Assistant stream failed.',
                    );
            }
        };

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                buffer = drainBufferedEvents(buffer);

                if (streamCompleted) {
                    return;
                }
            }

            if (buffer.trim() !== '') {
                drainBufferedEvents(buffer);
            }
        } finally {
            if (streamAbortRef.current === controller) {
                streamAbortRef.current = null;
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <>
            <Head title="Chat Dashboard" />

            <div className="relative flex h-screen w-screen overflow-hidden bg-white font-sans text-slate-800">
                {/* Mobile sidebar backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Left Sidebar */}
                <aside
                    className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300 lg:static lg:h-screen dark:bg-slate-950 ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full overflow-hidden lg:w-16 lg:translate-x-0'} `}
                >
                    {sidebarOpen ? (
                        <div className="flex h-full w-full flex-col">
                            {/* Sidebar Header */}
                            <div className="flex h-16 shrink-0 items-center justify-between px-4">
                                <div className="flex items-center overflow-visible">
                                    <DekaLogo className="ml-1 h-9 w-auto origin-left scale-[3.6] object-contain" />
                                </div>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-200/50"
                                    title="Tutup sidebar"
                                >
                                    <Sidebar className="h-5 w-5" />
                                </button>
                            </div>

                            {/* New Chat Button */}
                            <div className="p-4">
                                <button
                                    onClick={handleNewChat}
                                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4 text-white" />
                                    Percakapan Baru
                                </button>
                            </div>

                            {/* Conversation History */}
                            <div
                                className="flex-1 space-y-1 overflow-y-auto px-3 pb-4"
                                style={{ scrollbarWidth: 'none' }}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setHistoryOpen((open) => !open)
                                    }
                                    className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-extrabold tracking-[0.12em] text-slate-500 uppercase transition hover:bg-slate-100 hover:text-slate-700"
                                >
                                    <History className="h-4 w-4 shrink-0" />
                                    <span className="flex-1">Riwayat</span>
                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {historyOpen && (
                                    <div className="space-y-3">
                                        {groupedConversations.length === 0 ? (
                                            <p className="px-3 py-2 text-xs text-slate-400 italic">
                                                Belum ada percakapan tersimpan
                                            </p>
                                        ) : (
                                            groupedConversations.map(
                                                (group) => (
                                                    <div
                                                        key={group.label}
                                                        className="space-y-0.5"
                                                    >
                                                        <p className="px-3 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
                                                            {group.label}
                                                        </p>

                                                        {group.conversations.map(
                                                            (conv) => (
                                                                <button
                                                                    key={
                                                                        conv.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleSelectConversation(
                                                                            conv.id,
                                                                        )
                                                                    }
                                                                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-l-4 px-3 py-1.5 text-left text-[13px] transition ${
                                                                        activeConversationId ===
                                                                        conv.id
                                                                            ? 'border-y-transparent border-r-transparent border-l-blue-600 bg-blue-50 font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100'
                                                                            : 'border-y-transparent border-r-transparent border-l-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                                                    }`}
                                                                >
                                                                    <MessageSquare
                                                                        className={`h-3.5 w-3.5 shrink-0 ${activeConversationId === conv.id ? 'text-blue-600' : 'text-slate-400'}`}
                                                                    />
                                                                    <span className="flex-1 truncate">
                                                                        {conv.title ||
                                                                            'Percakapan Tanpa Judul'}
                                                                    </span>
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                ),
                                            )
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Footer */}
                            {user && (
                                <div className="border-t border-slate-100 bg-white p-3 dark:border-slate-900 dark:bg-slate-950">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent p-2 text-left transition outline-none hover:border-slate-200 hover:bg-slate-50 focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-100">
                                                <UserInfo user={user} />
                                                <ChevronDown className="ml-auto size-4 text-slate-500" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className="w-64 rounded-xl border border-slate-200 p-1.5 shadow-lg"
                                            align="start"
                                            side="top"
                                        >
                                            <UserMenuContent
                                                user={user}
                                                onSettingsClick={() =>
                                                    setSettingsOpen(true)
                                                }
                                                onLogoutClick={() =>
                                                    setLogoutConfirmOpen(true)
                                                }
                                            />
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="hidden h-full w-16 flex-col items-center justify-between py-5 lg:flex">
                            {/* Top icons */}
                            <div className="flex w-full flex-col items-center gap-6">
                                {/* Deka Logo button (Click to open sidebar) */}
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="cursor-pointer rounded-xl p-1 transition-all duration-200 hover:scale-105 hover:bg-slate-200/50 active:scale-95"
                                    title="Buka sidebar"
                                >
                                    <DekaLogo className="h-9 w-9 object-contain" />
                                </button>

                                {/* New Chat icon button */}
                                <button
                                    onClick={handleNewChat}
                                    className="mt-2 cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-all hover:scale-105 hover:bg-slate-200/50 hover:text-blue-600 active:scale-95"
                                    title="Percakapan Baru"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>

                                {/* Chat history / Search icon */}
                                <button
                                    onClick={() => {
                                        setSidebarOpen(true);
                                        setHistoryOpen(true);
                                    }}
                                    className="cursor-pointer rounded-xl p-2.5 text-slate-400 transition-all hover:bg-slate-200/50 hover:text-slate-600"
                                    title="Tampilkan Riwayat Chat"
                                >
                                    <History className="h-4.5 w-4.5" />
                                </button>
                            </div>

                            {/* Bottom profile */}
                            {user && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex cursor-pointer items-center justify-center rounded-full transition outline-none hover:ring-2 hover:ring-blue-500/50">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
                                                {user.name
                                                    .substring(0, 2)
                                                    .toUpperCase()}
                                            </div>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="w-64 rounded-xl border border-slate-200 p-1.5 shadow-lg"
                                        align="start"
                                        side="right"
                                    >
                                        <UserMenuContent
                                            user={user}
                                            onSettingsClick={() =>
                                                setSettingsOpen(true)
                                            }
                                            onLogoutClick={() =>
                                                setLogoutConfirmOpen(true)
                                            }
                                        />
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    )}
                </aside>

                {/* Main Content Area */}
                <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-white">
                    {/* Floating Mobile Sidebar Trigger (Logo button) */}
                    {!sidebarOpen && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="fixed top-4 left-4 z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200/85 bg-white shadow-md transition-all hover:scale-105 active:scale-95 lg:hidden"
                            title="Buka sidebar"
                        >
                            <DekaLogo className="h-6 w-6 object-contain" />
                        </button>
                    )}

                    {/* Chat Feed */}
                    <div
                        className="flex-1 overflow-y-auto"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {messages.length === 0 ? (
                            <div className="mx-auto flex h-full w-full max-w-2xl translate-y-3 flex-col items-center justify-center px-6 py-8 text-center">
                                <div className="mb-5 rounded-full border border-slate-200/70 bg-white p-3 shadow-sm dark:bg-slate-800">
                                    <DekaLogo className="h-14 w-auto object-contain" />
                                </div>
                                <h2 className="mb-3 max-w-xl text-4xl leading-[1.08] font-black tracking-normal text-blue-600 md:text-5xl dark:text-blue-500">
                                    Ada yang bisa saya bantu hari ini?
                                </h2>
                                <p className="mb-7 max-w-lg text-sm leading-relaxed text-slate-500 md:text-base dark:text-slate-400">
                                    Tanyakan apa saja seputar Deka, layanan
                                    kami, alamat, kontak, atau informasi
                                    lainnya.
                                </p>

                                {/* Suggestion Cards */}
                                <div className="grid w-full max-w-xl grid-cols-1 gap-3.5 md:grid-cols-2">
                                    <button
                                        onClick={() =>
                                            handleSendMessage('Apa itu Deka?')
                                        }
                                        className="group flex min-h-[118px] cursor-pointer flex-col items-start rounded-xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                                    >
                                        <HelpCircle className="mb-2.5 h-5 w-5 text-blue-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="text-slate-805 text-sm font-bold transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                                            Apa itu Deka?
                                        </span>
                                        <span className="text-slate-450 mt-1.5 text-xs leading-relaxed dark:text-slate-400">
                                            Cari tahu informasi dasar mengenai
                                            Deka.
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSendMessage('Layanan Deka')
                                        }
                                        className="group flex min-h-[118px] cursor-pointer flex-col items-start rounded-xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                                    >
                                        <Sparkles className="mb-2.5 h-5 w-5 text-indigo-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="text-slate-805 text-sm font-bold transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                                            Layanan Deka
                                        </span>
                                        <span className="text-slate-450 mt-1.5 text-xs leading-relaxed dark:text-slate-400">
                                            Pelajari layanan dan produk yang
                                            kami sediakan.
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSendMessage(
                                                'Kontak dan alamat',
                                            )
                                        }
                                        className="group flex min-h-[118px] cursor-pointer flex-col items-start rounded-xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                                    >
                                        <Phone className="mb-2.5 h-5 w-5 text-emerald-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="text-slate-805 text-sm font-bold transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                                            Kontak & Alamat
                                        </span>
                                        <span className="text-slate-450 mt-1.5 text-xs leading-relaxed dark:text-slate-400">
                                            Dapatkan nomor telepon, email, dan
                                            alamat kantor.
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSendMessage(
                                                'Fitur chatbot ini',
                                            )
                                        }
                                        className="group flex min-h-[118px] cursor-pointer flex-col items-start rounded-xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                                    >
                                        <Info className="mb-2.5 h-5 w-5 text-purple-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="text-slate-805 text-sm font-bold transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                                            Fitur Chatbot
                                        </span>
                                        <span className="text-slate-450 mt-1.5 text-xs leading-relaxed dark:text-slate-400">
                                            Ketahui kemampuan asisten AI dalam
                                            membantu Anda.
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 px-3 pt-6 pb-6 lg:pt-[130px] md:px-4">
                                {messages.map((message, index) => {
                                    const isLastMessage =
                                        index === messages.length - 1;

                                    return (
                                        <div
                                            key={message.id}
                                            className="animate-fade-in mx-auto w-full max-w-[860px] py-2"
                                        >
                                            {message.role === 'user' ? (
                                                <div className="flex w-full justify-end">
                                                    <div className="max-w-[85%] rounded-3xl border border-slate-200/50 bg-slate-100 px-5 py-2.5 text-base whitespace-pre-wrap text-slate-800 md:text-[18px] dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-100">
                                                        {message.content}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex w-full items-start gap-4">
                                                    {/* Left side avatar: Styled container with original logo */}
                                                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white shadow-sm">
                                                        <DekaLogo className="h-6 w-6 object-contain" />
                                                    </div>
                                                    <div className="flex-1 text-base leading-relaxed whitespace-pre-wrap text-slate-800 md:text-[18px] dark:text-slate-200">
                                                        {/* Text content sits directly on the page, no card container */}
                                                        <div className="prose prose-slate dark:prose-invert max-w-none text-base leading-relaxed md:text-[18px]">
                                                            <MarkdownRenderer
                                                                content={
                                                                    message.content
                                                                }
                                                            />
                                                        </div>

                                                        {/* Thumbs up/down icons & Response times */}
                                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                                                            {/* Good / Bad response feedback buttons */}
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() =>
                                                                        handleToggleFeedback(
                                                                            message.id,
                                                                            'like',
                                                                        )
                                                                    }
                                                                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800"
                                                                    title="Suka jawaban ini"
                                                                >
                                                                    <ThumbsUp
                                                                        className={`h-4.5 w-4.5 ${
                                                                            msgFeedback[
                                                                                message
                                                                                    .id
                                                                            ] ===
                                                                            'like'
                                                                                ? 'scale-110 fill-emerald-500/20 text-emerald-500'
                                                                                : ''
                                                                        }`}
                                                                    />
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        handleToggleFeedback(
                                                                            message.id,
                                                                            'dislike',
                                                                        )
                                                                    }
                                                                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                                                                    title="Tidak suka jawaban ini"
                                                                >
                                                                    <ThumbsDown
                                                                        className={`h-4.5 w-4.5 ${
                                                                            msgFeedback[
                                                                                message
                                                                                    .id
                                                                            ] ===
                                                                            'dislike'
                                                                                ? 'scale-110 fill-rose-500/20 text-rose-500'
                                                                                : ''
                                                                        }`}
                                                                    />
                                                                </button>
                                                            </div>

                                                            {/* Timing Info */}
                                                            {(message.response_time_ms !==
                                                                undefined ||
                                                                message.first_delta_at_ms !==
                                                                    undefined) && (
                                                                <div className="text-[11px] font-medium text-slate-400/80">
                                                                    {[
                                                                        (() => {
                                                                            const firstDelta =
                                                                                formatDuration(
                                                                                    message.first_delta_at_ms,
                                                                                );

                                                                            return firstDelta !==
                                                                                null
                                                                                ? `Mulai jawab ${firstDelta}`
                                                                                : null;
                                                                        })(),
                                                                        (() => {
                                                                            const total =
                                                                                formatDuration(
                                                                                    message.response_time_ms,
                                                                                );

                                                                            return total !==
                                                                                null
                                                                                ? `selesai ${total}`
                                                                                : null;
                                                                        })(),
                                                                    ]
                                                                        .filter(
                                                                            Boolean,
                                                                        )
                                                                        .join(
                                                                            ' | ',
                                                                        )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Dive Deeper (Follow-up suggestions) */}
                                                        {isLastMessage &&
                                                            !isGenerating && (
                                                                <div className="animate-fade-in mt-5 border-t border-slate-100/50 pt-4 dark:border-slate-800/50">
                                                                    <span className="mb-2.5 block text-[10px] font-bold tracking-widest text-slate-400/80 uppercase">
                                                                        DIVE
                                                                        DEEPER
                                                                    </span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {getFollowUpSuggestions(
                                                                            message.content,
                                                                        ).map(
                                                                            (
                                                                                suggestion,
                                                                                idx,
                                                                            ) => (
                                                                                <button
                                                                                    key={
                                                                                        idx
                                                                                    }
                                                                                    onClick={() =>
                                                                                        handleSendMessage(
                                                                                            suggestion,
                                                                                        )
                                                                                    }
                                                                                    className="dark:text-slate-350 cursor-pointer rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm transition-all duration-250 hover:border-blue-500 hover:bg-blue-50/20 hover:text-blue-600 active:scale-95 md:text-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-blue-50/10 dark:hover:text-blue-400"
                                                                                >
                                                                                    {
                                                                                        suggestion
                                                                                    }
                                                                                </button>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Typing / Thinking Indicator */}
                                {isGenerating &&
                                    messages[messages.length - 1]?.role !==
                                        'assistant' && (
                                        <div className="mx-auto w-full max-w-[860px]">
                                            <div className="flex w-full items-start gap-4">
                                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white shadow-sm">
                                                    <DekaLogo className="h-6 w-6 object-contain" />
                                                </div>
                                                <div className="border-slate-150/70 w-fit rounded-2xl rounded-tl-none border bg-white px-5 py-3.5 shadow-sm">
                                                    <div className="flex items-center gap-2.5 text-slate-500 font-medium text-[15px]">
                                                        <Loader2 className="h-4.5 w-4.5 animate-spin text-slate-400" />
                                                        <span>Thinking...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="bg-white p-4">
                        <div className="mx-auto w-full max-w-3xl">
                            <div className="relative flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-md shadow-slate-100/30 transition-all duration-300 focus-within:border-blue-500/80 focus-within:ring-4 focus-within:ring-blue-500/10">
                                {/* Central textarea */}
                                <textarea
                                    value={inputValue}
                                    onChange={(e) =>
                                        setInputValue(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tulis pertanyaan tentang Deka di sini..."
                                    rows={1}
                                    className="max-h-24 min-h-[40px] flex-1 resize-none scrollbar-none bg-transparent pl-4 pr-2 py-2.5 text-sm text-slate-800 outline-none md:text-base"
                                />

                                {/* Right action buttons: Send button */}
                                <div className="flex flex-shrink-0 items-center pr-1">
                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={
                                            !inputValue.trim() || isGenerating
                                        }
                                        className="disabled:bg-blue-600/40 disabled:text-white/60 inline-flex h-9.5 w-9.5 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-95 disabled:shadow-none disabled:cursor-not-allowed"
                                    >
                                        <SendHorizontal className="h-4.5 w-4.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="mt-2.5 text-center text-[10px] text-slate-400 md:text-xs">
                                Asisten AI Deka dapat membuat kesalahan.
                                Pertimbangkan untuk memeriksa informasi penting.
                            </p>
                        </div>
                    </div>
                    <SettingsModal
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                    />
                    {user && (
                        <LogoutConfirmModal
                            isOpen={logoutConfirmOpen}
                            onClose={() => setLogoutConfirmOpen(false)}
                            user={user}
                        />
                    )}
                </main>
            </div>
        </>
    );
}

const parseInline = (text: string): React.ReactNode[] => {
    // Regex for bold (**text**), italic (*text* or _text_), and inline code (`code`)
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong
                    key={index}
                    className="font-extrabold text-slate-950 dark:text-white"
                >
                    {part.slice(2, -2)}
                </strong>
            );
        }

        if (part.startsWith('*') && part.endsWith('*')) {
            return (
                <em
                    key={index}
                    className="text-slate-800 italic dark:text-slate-200"
                >
                    {part.slice(1, -1)}
                </em>
            );
        }

        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code
                    key={index}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-rose-600 dark:bg-slate-800 dark:text-rose-400"
                >
                    {part.slice(1, -1)}
                </code>
            );
        }

        return part;
    });
};

const MarkdownRenderer = ({ content }: { content: string }) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

    let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null =
        null;

    const flushList = (key: number) => {
        if (!currentList) {
            return;
        }

        if (currentList.type === 'ul') {
            elements.push(
                <ul
                    key={`ul-${key}`}
                    className="my-3 ml-4 list-inside list-disc space-y-1.5 text-base text-slate-800 md:text-[18px] dark:text-slate-200"
                >
                    {currentList.items}
                </ul>,
            );
        } else {
            elements.push(
                <ol
                    key={`ol-${key}`}
                    className="my-3 ml-4 list-inside list-decimal space-y-1.5 text-base text-slate-800 md:text-[18px] dark:text-slate-200"
                >
                    {currentList.items}
                </ol>,
            );
        }

        currentList = null;
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        // Check for empty line
        if (!trimmed) {
            flushList(idx);
            elements.push(<div key={`br-${idx}`} className="h-2" />);

            return;
        }

        // Check for Headings
        if (trimmed.startsWith('# ')) {
            flushList(idx);
            elements.push(
                <h1
                    key={idx}
                    className="mt-4 mb-2 text-2xl font-black text-slate-900 dark:text-white"
                >
                    {parseInline(trimmed.slice(2))}
                </h1>,
            );

            return;
        }

        if (trimmed.startsWith('## ')) {
            flushList(idx);
            elements.push(
                <h2
                    key={idx}
                    className="mt-4.5 mb-2 text-xl font-bold text-slate-900 dark:text-white"
                >
                    {parseInline(trimmed.slice(3))}
                </h2>,
            );

            return;
        }

        if (trimmed.startsWith('### ')) {
            flushList(idx);
            elements.push(
                <h3
                    key={idx}
                    className="mt-4 mb-1.5 text-lg font-bold text-slate-900 dark:text-white"
                >
                    {parseInline(trimmed.slice(4))}
                </h3>,
            );

            return;
        }

        // Check for Unordered List Item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (currentList && currentList.type !== 'ul') {
                flushList(idx);
            }

            if (!currentList) {
                currentList = { type: 'ul', items: [] };
            }

            const cleanText = trimmed.startsWith('- ')
                ? trimmed.slice(2)
                : trimmed.slice(2);
            currentList.items.push(
                <li key={`li-${idx}`} className="leading-relaxed">
                    {parseInline(cleanText)}
                </li>,
            );

            return;
        }

        // Check for Ordered List Item
        const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

        if (orderedMatch) {
            if (currentList && currentList.type !== 'ol') {
                flushList(idx);
            }

            if (!currentList) {
                currentList = { type: 'ol', items: [] };
            }

            const cleanText = orderedMatch[2];
            currentList.items.push(
                <li key={`li-${idx}`} className="leading-relaxed">
                    {parseInline(cleanText)}
                </li>,
            );

            return;
        }

        // Regular text line
        flushList(idx);
        elements.push(
            <p
                key={idx}
                className="text-base leading-relaxed text-slate-800 md:text-[18px] dark:text-slate-200"
            >
                {parseInline(line)}
            </p>,
        );
    });

    // Flush any remaining list
    flushList(lines.length);

    return <div className="space-y-1.5">{elements}</div>;
};
