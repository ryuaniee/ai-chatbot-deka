import { Head, useHttp, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ExternalLink,
    HelpCircle,
    History,
    Info,
    MapPin,
    MessageSquare,
    MoreHorizontal,
    Pencil,
    Phone,
    Plus,
    Search,
    SendHorizontal,
    Sidebar,
    Sparkles,
    Loader2,
    AlertCircle,
    ThumbsDown,
    ThumbsUp,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import DekaLogo from '@/components/deka-logo';
import LogoutConfirmModal from '@/components/logout-confirm-modal';
import SettingsModal from '@/components/settings-modal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import {
    index as getConversations,
    show as getConversation,
} from '@/routes/api/conversations';

const markdownLinkPattern = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Official DEKA office location on Google Maps */
const DEKA_MAPS_URL = 'https://maps.app.goo.gl/keVnm8RWKmJtrWJR7';
const DEKA_MAPS_EMBED_URL =
    'https://www.google.com/maps?q=Jl.+Keledang+No.+48,+Gn.+Kelua,+Samarinda+Ulu,+Samarinda,+Kalimantan+Timur&z=16&output=embed';
const DEKA_MAPS_ADDRESS =
    'Jl. Keledang No. 48, Gn. Kelua, Samarinda Ulu, Samarinda';

const isGoogleMapsUrl = (href: string): boolean => {
    try {
        const url = new URL(href);
        const host = url.hostname.toLowerCase();

        if (
            host === 'maps.app.goo.gl' ||
            host === 'goo.gl' ||
            host === 'g.page' ||
            host.endsWith('.goo.gl')
        ) {
            return true;
        }

        if (host === 'maps.google.com' || host === 'maps.google.co.id') {
            return true;
        }

        if (host.includes('google.')) {
            return (
                url.pathname.startsWith('/maps') ||
                url.searchParams.has('q') ||
                url.searchParams.has('query')
            );
        }

        return false;
    } catch {
        return false;
    }
};

const normalizeMapsHref = (href: string): string => {
    if (!isGoogleMapsUrl(href)) {
        return href;
    }

    return DEKA_MAPS_URL;
};

const extractMarkdownLink = (
    text: string,
): { label: string; href: string } | null => {
    const match = text.trim().match(markdownLinkPattern);

    if (!match) {
        return null;
    }

    const [, label, href] = match;

    return { label, href };
};

const renderMapsPreview = (
    key: string,
    href: string,
    label = 'Buka di Google Maps',
) => {
    const mapsHref = normalizeMapsHref(href);
    const previewLabel =
        label.trim() === '' || /^https?:\/\//i.test(label)
            ? DEKA_MAPS_ADDRESS
            : label;

    return (
        <div
            key={key}
            className="my-3 w-full max-w-xl overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm"
        >
            <div className="relative aspect-[16/9] w-full bg-slate-100">
                <iframe
                    title="Lokasi DEKA di Google Maps"
                    src={DEKA_MAPS_EMBED_URL}
                    className="absolute inset-0 h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                />
            </div>
            <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-4 bg-linear-to-br from-blue-50 via-white to-sky-50 px-4 py-3 text-left transition hover:bg-blue-50"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 md:text-[15px]">
                            Google Maps · Kantor DEKA
                        </p>
                        <p className="truncate text-xs text-slate-500 md:text-sm">
                            {previewLabel}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-blue-600">
                            {mapsHref}
                        </p>
                    </div>
                </div>
                <ExternalLink className="h-4.5 w-4.5 flex-none text-blue-500 transition group-hover:text-blue-600" />
            </a>
        </div>
    );
};

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

const dislikeReasonOptions = [
    'Jawaban kurang lengkap',
    'Tidak menjawab pertanyaan',
    'Data tidak akurat',
    'Bahasa sulit dipahami',
];

function ConversationListSkeleton() {
    return (
        <div className="space-y-3 px-1 py-1">
            {[0, 1, 2].map((group) => (
                <div key={group} className="space-y-2">
                    <Skeleton className="ml-2 h-3 w-20 bg-slate-200/80" />
                    {[0, 1, 2].map((item) => (
                        <div
                            key={item}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-2"
                        >
                            <Skeleton className="h-4 w-4 rounded bg-slate-200/80" />
                            <Skeleton
                                className={`h-4 bg-slate-200/80 ${item === 1 ? 'w-28' : 'w-40'}`}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function ChatMessagesSkeleton() {
    return (
        <div className="space-y-7 px-4 pt-8 pb-8 lg:pt-[120px]">
            <div className="mx-auto flex w-full max-w-[860px] justify-end">
                <div className="w-full max-w-[58%] space-y-2 rounded-3xl bg-slate-100 px-5 py-4">
                    <Skeleton className="h-4 w-full bg-slate-200/90" />
                    <Skeleton className="h-4 w-3/5 bg-slate-200/90" />
                </div>
            </div>
            <div className="mx-auto flex w-full max-w-[860px] items-start gap-4">
                <Skeleton className="h-9 w-9 rounded-full bg-slate-200/80" />
                <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-4 w-11/12 bg-slate-200/80" />
                    <Skeleton className="h-4 w-full bg-slate-200/80" />
                    <Skeleton className="h-4 w-4/5 bg-slate-200/80" />
                    <Skeleton className="h-4 w-2/5 bg-slate-200/80" />
                </div>
            </div>
            <div className="mx-auto flex w-full max-w-[860px] justify-end">
                <div className="w-full max-w-[48%] space-y-2 rounded-3xl bg-slate-100 px-5 py-4">
                    <Skeleton className="h-4 w-full bg-slate-200/90" />
                    <Skeleton className="h-4 w-1/2 bg-slate-200/90" />
                </div>
            </div>
        </div>
    );
}

export default function ChatPage() {
    const { auth } = usePage().props;
    const { submit } = useHttp();

    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingConversation, setIsLoadingConversation] = useState(false);
    const [activeConversationId, setActiveConversationId] = useState<
        number | null
    >(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [deletingConversationId, setDeletingConversationId] = useState<
        number | null
    >(null);
    const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(
        null,
    );
    const [renameTarget, setRenameTarget] = useState<ConversationItem | null>(
        null,
    );
    const [renameTitle, setRenameTitle] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
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
    const [feedbackReasons, setFeedbackReasons] = useState<
        Record<string | number, string>
    >(() => {
        try {
            const saved = localStorage.getItem('deka_chat_feedback_reasons');

            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [dislikeDialogMessageId, setDislikeDialogMessageId] = useState<
        string | number | null
    >(null);
    const [dislikeReason, setDislikeReason] = useState('');

    const persistFeedback = async (
        messageId: string | number,
        type: 'like' | 'dislike' | null,
        reason?: string,
    ) => {
        const message = messages.find((item) => item.id === messageId);
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        if (!message || !csrfToken) {
            return;
        }

        await fetch(
            `/api/conversations/${message.conversation_id}/messages/${message.id}/feedback`,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({ type, reason }),
            },
        );
    };

    const applyFeedback = (
        messageId: string | number,
        type: 'like' | 'dislike' | null,
        reason?: string,
    ) => {
        const normalizedReason = reason?.trim() ?? '';

        setFeedbackReasons((prev) => {
            const next = { ...prev };

            if (type === 'dislike' && normalizedReason) {
                next[messageId] = normalizedReason;
            } else {
                delete next[messageId];
            }

            localStorage.setItem(
                'deka_chat_feedback_reasons',
                JSON.stringify(next),
            );

            return next;
        });

        setMsgFeedback((prev) => {
            const next = { ...prev };

            if (type === null) {
                delete next[messageId];
            } else {
                next[messageId] = type;
            }

            localStorage.setItem('deka_chat_feedback', JSON.stringify(next));

            return next;
        });

        void persistFeedback(messageId, type, normalizedReason).catch(
            (error) => {
                console.error('Failed to persist feedback:', error);
            },
        );
    };

    const handleToggleFeedback = (
        messageId: string | number,
        type: 'like' | 'dislike',
    ) => {
        const nextType = msgFeedback[messageId] === type ? null : type;

        if (type === 'dislike' && nextType === 'dislike') {
            setDislikeDialogMessageId(messageId);
            setDislikeReason(feedbackReasons[messageId] ?? '');

            return;
        }

        applyFeedback(messageId, nextType);
    };

    const submitDislikeReason = () => {
        if (dislikeDialogMessageId === null) {
            return;
        }

        applyFeedback(dislikeDialogMessageId, 'dislike', dislikeReason);
        setDislikeDialogMessageId(null);
        setDislikeReason('');
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
            content.includes('solusi') ||
            content.includes('ai')
        ) {
            return [
                'Solusi AI DEKA',
                'Jam operasional DEKA',
                'Kontak resmi DEKA',
            ];
        }

        if (
            content.includes('fitur') ||
            content.includes('bantu') ||
            content.includes('bisa apa')
        ) {
            return ['Apa itu DEKA?', 'Layanan IT DEKA', 'Kontak & Alamat'];
        }

        return [
            'Hubungi tim DEKA',
            'Layanan transformasi digital',
            'Tentang DEKA',
        ];
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const streamAbortRef = useRef<AbortController | null>(null);
    const selectedConversationRequestRef = useRef(0);
    const nextTempIdRef = useRef(-1);

    const user = auth.user;
    const normalizedHistorySearch = historySearch.trim().toLowerCase();
    const visibleConversations =
        normalizedHistorySearch === ''
            ? conversations
            : conversations.filter((conversation) =>
                  (conversation.title || 'Percakapan Tanpa Judul')
                      .toLowerCase()
                      .includes(normalizedHistorySearch),
              );
    const groupedConversations =
        groupConversationsByRecency(visibleConversations);
    const hasMessages = messages.length > 0;

    const fetchConversations = () => {
        setIsLoadingConversations(true);
        submit(getConversations())
            .then((res: any) => {
                setConversations(res.data || []);
            })
            .catch((err) => {
                console.error('Failed to fetch conversations:', err);
            })
            .finally(() => {
                setIsLoadingConversations(false);
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
            })
            .finally(() => {
                setIsLoadingConversations(false);
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

    useEffect(() => {
        const textarea = inputRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }, [inputValue]);

    const handleSelectConversation = (id: number) => {
        streamAbortRef.current?.abort();
        const requestId = selectedConversationRequestRef.current + 1;

        selectedConversationRequestRef.current = requestId;
        setActiveConversationId(id);
        setIsGenerating(false);
        setIsLoadingConversation(true);
        setChatError(null);
        setSidebarOpen(false);
        submit(getConversation(id))
            .then((res: any) => {
                if (selectedConversationRequestRef.current !== requestId) {
                    return;
                }

                setMessages(res.data?.messages || []);
            })
            .catch((err) => {
                console.error('Failed to fetch conversation:', err);

                if (selectedConversationRequestRef.current === requestId) {
                    setChatError(
                        'Gagal membuka riwayat percakapan. Coba pilih ulang.',
                    );
                }
            })
            .finally(() => {
                if (selectedConversationRequestRef.current === requestId) {
                    setIsLoadingConversation(false);
                }
            });
    };

    const handleNewChat = () => {
        streamAbortRef.current?.abort();
        selectedConversationRequestRef.current += 1;
        setActiveConversationId(null);
        setMessages([]);
        setInputValue('');
        setIsGenerating(false);
        setIsLoadingConversation(false);
        setChatError(null);
        setSidebarOpen(false);
    };

    const openRenameConversation = (conversation: ConversationItem) => {
        setRenameTarget(conversation);
        setRenameTitle(conversation.title || '');
        setChatError(null);
    };

    const openDeleteConversation = (conversation: ConversationItem) => {
        setDeleteTarget(conversation);
        setChatError(null);
    };

    const handleRenameConversation = async () => {
        if (!renameTarget || isRenaming) {
            return;
        }

        const title = renameTitle.trim();

        if (title === '') {
            setChatError('Judul percakapan tidak boleh kosong.');

            return;
        }

        setIsRenaming(true);
        setChatError(null);

        try {
            const csrfToken = document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content;

            const response = await fetch(
                `/api/conversations/${renameTarget.id}`,
                {
                    method: 'PATCH',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken ?? '',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ title }),
                },
            );

            if (!response.ok) {
                const payload = await response.json().catch(() => null);

                throw new Error(
                    payload?.message ?? 'Gagal mengubah judul percakapan.',
                );
            }

            const payload = await response.json();
            const updated = payload.data as ConversationItem;

            setConversations((prev) =>
                prev.map((conversation) =>
                    conversation.id === updated.id ? updated : conversation,
                ),
            );
            setRenameTarget(null);
            setRenameTitle('');
        } catch (error) {
            console.error('Failed to rename conversation:', error);
            setChatError(
                error instanceof Error
                    ? error.message
                    : 'Gagal mengubah judul percakapan. Coba lagi.',
            );
        } finally {
            setIsRenaming(false);
        }
    };

    const handleDeleteConversation = async () => {
        if (!deleteTarget || deletingConversationId !== null) {
            return;
        }

        const conversationId = deleteTarget.id;
        setDeletingConversationId(conversationId);
        setChatError(null);

        try {
            const csrfToken = document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content;

            const response = await fetch(
                `/api/conversations/${conversationId}`,
                {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken ?? '',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) {
                throw new Error('Gagal menghapus percakapan.');
            }

            setConversations((prev) =>
                prev.filter(
                    (conversation) => conversation.id !== conversationId,
                ),
            );

            if (activeConversationId === conversationId) {
                handleNewChat();
            }

            setDeleteTarget(null);
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            setChatError(
                error instanceof Error
                    ? error.message
                    : 'Gagal menghapus percakapan. Coba lagi.',
            );
        } finally {
            setDeletingConversationId(null);
        }
    };

    const handleSendMessage = async (customText?: string) => {
        const text = (customText || inputValue).trim();

        if (!text || isGenerating) {
            return;
        }

        if (!customText) {
            setInputValue('');
        }

        setChatError(null);
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

            const message =
                err instanceof Error ? err.message : 'Gagal mengirim pesan.';

            if (message.includes('429') || /rate limit/i.test(message)) {
                setChatError(
                    'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
                );
            } else if (/moderat|policy|blocked/i.test(message)) {
                setChatError(
                    'Pesan diblokir kebijakan keamanan. Ubah pertanyaan Anda.',
                );
            } else if (/network|fetch|Failed to fetch/i.test(message)) {
                setChatError(
                    'Koneksi bermasalah. Periksa jaringan lalu coba lagi.',
                );
            } else if (/unavailable|misconfigured|502|503/i.test(message)) {
                setChatError(
                    'Asisten AI sementara tidak tersedia. Coba beberapa saat lagi.',
                );
            } else {
                setChatError(
                    'Gagal mendapatkan jawaban. Silakan coba kirim ulang.',
                );
            }
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
            let detail = `HTTP ${response.status}`;

            if (contentType.includes('application/json')) {
                const payload = await response.json();
                detail = payload.message ?? detail;
            } else {
                const text = await response.text();

                if (text.trim() !== '') {
                    detail = text;
                }
            }

            throw new Error(`${detail} (${response.status})`);
        }

        if (response.body === null) {
            throw new Error('Stream body is unavailable.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const tempAssistantId = nextTempId();
        let buffer = '';
        let streamCompleted = false;
        let receivedAssistantContent = false;

        const fallbackAssistantMessage = (): MessageItem => ({
            id: tempAssistantId,
            conversation_id: activeConversationId ?? conversationId ?? 0,
            reply_to_message_id: null,
            role: 'assistant',
            content:
                'Maaf, layanan AI sedang lambat atau tidak merespons. Silakan coba kirim ulang beberapa saat lagi.',
            sequence: messages.length + 2,
            created_at: new Date().toISOString(),
        });

        const ensureFallbackAssistantMessage = () => {
            setMessages((prev) => {
                const hasContent = prev.some(
                    (message) =>
                        message.role === 'assistant' &&
                        message.content.trim() !== '' &&
                        (message.id === tempAssistantId ||
                            message.reply_to_message_id !== null ||
                            message.id > 0),
                );

                if (hasContent) {
                    return prev.filter(
                        (message) =>
                            message.id !== tempAssistantId ||
                            message.content.trim() !== '',
                    );
                }

                return [
                    ...prev.filter((message) => message.id !== tempAssistantId),
                    fallbackAssistantMessage(),
                ];
            });
        };

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

                    if (!receivedAssistantContent) {
                        ensureFallbackAssistantMessage();
                    }

                    return '';
                }

                try {
                    applyEvent(JSON.parse(payload) as StreamEventPayload);
                } catch (error) {
                    console.error('Failed to parse stream event:', error);
                }
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
                    // Force a paint per delta so React 18 batching does not
                    // collapse the whole answer into one instant full update.
                    flushSync(() => {
                        setMessages((prev) => {
                            const delta = event.delta ?? '';

                            if (delta.trim() !== '') {
                                receivedAssistantContent = true;
                            }

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
                    });

                    break;

                case 'message_complete':
                    if (event.assistant_message) {
                        if (event.assistant_message.content.trim() !== '') {
                            receivedAssistantContent = true;
                        }

                        setMessages((prev) => {
                            const withoutTemp = prev.filter(
                                (message) => message.id !== tempAssistantId,
                            );

                            return [
                                ...withoutTemp,
                                {
                                    ...event.assistant_message!,
                                    content:
                                        event.assistant_message!.content.trim() !==
                                        ''
                                            ? event.assistant_message!.content
                                            : fallbackAssistantMessage()
                                                  .content,
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

            if (!receivedAssistantContent) {
                ensureFallbackAssistantMessage();
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
                    className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-slate-50/90 transition-all duration-300 lg:static lg:h-screen ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full overflow-hidden lg:w-16 lg:translate-x-0'} `}
                >
                    {sidebarOpen ? (
                        <div className="flex h-full min-h-0 w-full flex-col">
                            {/* Sidebar Header */}
                            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/80 px-4">
                                <div className="flex items-center overflow-visible">
                                    <DekaLogo className="ml-1 h-9 w-auto origin-left scale-[3.6] object-contain" />
                                </div>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800 hover:shadow-sm"
                                    title="Tutup sidebar"
                                    aria-label="Tutup sidebar"
                                >
                                    <Sidebar className="h-5 w-5" />
                                </button>
                            </div>

                            {/* New Chat Button */}
                            <div className="p-4">
                                <button
                                    onClick={handleNewChat}
                                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:bg-blue-700 hover:shadow-blue-600/25 active:scale-[0.99]"
                                >
                                    <Plus className="h-4 w-4 text-white" />
                                    Percakapan Baru
                                </button>
                            </div>

                            <div className="px-4 pb-3">
                                <div className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 shadow-sm shadow-slate-200/40 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10">
                                    <Search className="h-4 w-4 shrink-0" />
                                    <input
                                        value={historySearch}
                                        onChange={(event) =>
                                            setHistorySearch(event.target.value)
                                        }
                                        placeholder="Cari riwayat..."
                                        aria-label="Cari riwayat percakapan"
                                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            {/* Conversation History */}
                            <div
                                className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4"
                                style={{ scrollbarWidth: 'none' }}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setHistoryOpen((open) => !open)
                                    }
                                    aria-expanded={historyOpen}
                                    className="mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-extrabold tracking-[0.12em] text-slate-500 uppercase transition hover:bg-white hover:text-slate-700 hover:shadow-sm"
                                >
                                    <History className="h-4 w-4 shrink-0" />
                                    <span className="flex-1">Riwayat</span>
                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {historyOpen && (
                                    <div className="space-y-3">
                                        {isLoadingConversations ? (
                                            <ConversationListSkeleton />
                                        ) : groupedConversations.length ===
                                          0 ? (
                                            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs leading-relaxed text-slate-400">
                                                {normalizedHistorySearch
                                                    ? 'Tidak ada riwayat yang cocok.'
                                                    : 'Belum ada percakapan tersimpan.'}
                                            </div>
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
                                                                <div
                                                                    key={
                                                                        conv.id
                                                                    }
                                                                    className={`group relative flex w-full items-center gap-1 rounded-xl border pr-1 transition ${
                                                                        activeConversationId ===
                                                                        conv.id
                                                                            ? 'border-blue-100 bg-white font-semibold text-blue-700 shadow-sm shadow-blue-950/5'
                                                                            : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800 hover:shadow-sm'
                                                                    }`}
                                                                >
                                                                    {activeConversationId ===
                                                                        conv.id && (
                                                                        <span className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-r-full bg-blue-600" />
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleSelectConversation(
                                                                                conv.id,
                                                                            )
                                                                        }
                                                                        className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] leading-5"
                                                                    >
                                                                        <MessageSquare
                                                                            className={`h-3.5 w-3.5 shrink-0 ${activeConversationId === conv.id ? 'text-blue-600' : 'text-slate-400'}`}
                                                                        />
                                                                        <span className="flex-1 truncate">
                                                                            {conv.title ||
                                                                                'Percakapan Tanpa Judul'}
                                                                        </span>
                                                                    </button>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger
                                                                            asChild
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                title="Opsi percakapan"
                                                                                aria-label="Opsi percakapan"
                                                                                className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200/70 hover:text-slate-700 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                                                            >
                                                                                {deletingConversationId ===
                                                                                conv.id ? (
                                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                ) : (
                                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                                )}
                                                                            </button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent
                                                                            align="end"
                                                                            className="w-44"
                                                                        >
                                                                            <DropdownMenuItem
                                                                                onSelect={() =>
                                                                                    openRenameConversation(
                                                                                        conv,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Pencil className="h-4 w-4" />
                                                                                Ubah
                                                                                judul
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                variant="destructive"
                                                                                onSelect={() =>
                                                                                    openDeleteConversation(
                                                                                        conv,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                                Hapus
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
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
                                <div className="shrink-0 border-t border-slate-200/70 bg-white/80 p-3">
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
                                    aria-label="Buka sidebar"
                                >
                                    <DekaLogo className="h-9 w-9 object-contain" />
                                </button>

                                {/* New Chat icon button */}
                                <button
                                    onClick={handleNewChat}
                                    className="mt-2 cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-all hover:scale-105 hover:bg-slate-200/50 hover:text-blue-600 active:scale-95"
                                    title="Percakapan Baru"
                                    aria-label="Buat percakapan baru"
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
                                    aria-label="Tampilkan riwayat chat"
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
                <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-[#f8fbff]">
                    <div
                        className={`pointer-events-none absolute inset-0 ${hasMessages ? 'opacity-[0.16]' : 'opacity-[0.42]'}`}
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 1px 1px, rgba(47, 128, 237, 0.2) 1px, transparent 0)',
                            backgroundSize: '28px 28px',
                        }}
                    />
                    <div
                        className={`pointer-events-none absolute inset-x-0 top-0 bg-linear-to-b from-white to-transparent ${hasMessages ? 'h-14 from-white/35 via-white/10' : 'h-56 via-white/80'}`}
                    />
                    <div
                        className={`pointer-events-none absolute top-[16%] right-[8%] h-72 w-72 rounded-full bg-blue-200 blur-3xl ${hasMessages ? 'opacity-10' : 'opacity-[0.22]'}`}
                    />
                    <div
                        className={`pointer-events-none absolute bottom-0 left-[20%] h-56 w-[32rem] rounded-full bg-cyan-200 blur-3xl ${hasMessages ? 'opacity-10' : 'opacity-[0.18]'}`}
                    />
                    {/* Floating Mobile Sidebar Trigger (Logo button) */}
                    {!sidebarOpen && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="fixed top-4 left-4 z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200/85 bg-white shadow-md transition-all hover:scale-105 active:scale-95 lg:hidden"
                            title="Buka sidebar"
                            aria-label="Buka sidebar"
                        >
                            <DekaLogo className="h-6 w-6 object-contain" />
                        </button>
                    )}

                    {/* Chat Feed */}
                    <div
                        className="flex-1 overflow-y-auto"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {isLoadingConversation ? (
                            <ChatMessagesSkeleton />
                        ) : messages.length === 0 ? (
                            <div className="relative mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-start px-6 pt-16 pb-6 text-center md:justify-center md:py-8">
                                <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-3 py-2 shadow-sm shadow-slate-200/60 backdrop-blur">
                                    <DekaLogo className="h-8 w-auto object-contain" />
                                    <span className="text-xs font-bold tracking-[0.16em] text-slate-400 uppercase">
                                        Chatbot
                                    </span>
                                </div>
                                <h2 className="mb-3 max-w-2xl text-[32px] leading-[1.06] font-black tracking-normal text-slate-950 md:text-5xl">
                                    Mulai dari satu pertanyaan tentang{' '}
                                    <span className="text-blue-600">DEKA</span>.
                                </h2>
                                <p className="mb-4 max-w-xl text-sm leading-relaxed text-slate-500 md:mb-5 md:text-base">
                                    Pilih saran cepat atau ketik sendiri.
                                    Jawaban disimpan di riwayat dan tetap fokus
                                    pada informasi yang tersedia tentang DEKA.
                                </p>
                                <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                                    <span className="rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 shadow-sm shadow-slate-200/40">
                                        Profil perusahaan
                                    </span>
                                    <span className="rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 shadow-sm shadow-slate-200/40">
                                        Layanan IT & AI
                                    </span>
                                    <span className="rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 shadow-sm shadow-slate-200/40">
                                        Kontak resmi
                                    </span>
                                </div>

                                {/* Suggestion Cards */}
                                <div className="flex w-full max-w-full snap-x scrollbar-none gap-2.5 overflow-x-auto pb-2 text-left md:grid md:max-w-2xl md:grid-cols-2 md:overflow-visible md:pb-0">
                                    <button
                                        onClick={() =>
                                            handleSendMessage('Apa itu DEKA?')
                                        }
                                        className="group flex min-h-[86px] min-w-[260px] cursor-pointer snap-center items-start gap-3 rounded-xl border border-slate-200/80 bg-white/88 px-4 py-3.5 text-left shadow-sm shadow-slate-200/60 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md md:min-h-[92px] md:min-w-0"
                                    >
                                        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                                                Apa itu DEKA?
                                            </span>
                                            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                                                Profil perusahaan dan fokus AI
                                                DEKA.
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSendMessage(
                                                'Layanan IT dan solusi AI DEKA',
                                            )
                                        }
                                        className="group flex min-h-[86px] min-w-[260px] cursor-pointer snap-center items-start gap-3 rounded-xl border border-slate-200/80 bg-white/88 px-4 py-3.5 text-left shadow-sm shadow-slate-200/60 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md md:min-h-[92px] md:min-w-0"
                                    >
                                        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                                                Layanan IT DEKA
                                            </span>
                                            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                                                Layanan digital dan solusi
                                                transformasi.
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSendMessage(
                                                'Kontak dan alamat kantor DEKA',
                                            )
                                        }
                                        className="group flex min-h-[86px] min-w-[260px] cursor-pointer snap-center items-start gap-3 rounded-xl border border-slate-200/80 bg-white/88 px-4 py-3.5 text-left shadow-sm shadow-slate-200/60 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md md:min-h-[92px] md:min-w-0"
                                    >
                                        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                                                Kontak & Alamat
                                            </span>
                                            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                                                Nomor telepon, email, dan alamat
                                                kantor.
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSendMessage(
                                                'Fitur chatbot DEKA',
                                            )
                                        }
                                        className="group flex min-h-[86px] min-w-[260px] cursor-pointer snap-center items-start gap-3 rounded-xl border border-slate-200/80 bg-white/88 px-4 py-3.5 text-left shadow-sm shadow-slate-200/60 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md md:min-h-[92px] md:min-w-0"
                                    >
                                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-purple-500 transition-transform duration-200 group-hover:scale-110" />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                                                Fitur Chatbot
                                            </span>
                                            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                                                Kemampuan asisten AI dalam
                                                membantu Anda.
                                            </span>
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-full flex-col space-y-5 px-3 pt-5 pb-6 md:px-4 md:pt-8 lg:pt-10">
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
                                                    <div className="text-wrap-anywhere max-w-[85%] min-w-0 rounded-3xl border border-slate-200/60 bg-white/90 px-5 py-2.5 text-base [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-800 shadow-sm shadow-slate-200/40 md:text-[17px]">
                                                        {message.content}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex w-full items-start gap-4">
                                                    {/* Left side avatar: Styled container with original logo */}
                                                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white shadow-sm">
                                                        <DekaLogo className="h-6 w-6 object-contain" />
                                                    </div>
                                                    <div className="min-w-0 flex-1 text-base leading-relaxed whitespace-pre-wrap text-slate-800 md:text-[17px]">
                                                        {/* Text content sits directly on the page, no card container */}
                                                        <div className="prose prose-slate text-wrap-anywhere max-w-none text-base leading-relaxed [overflow-wrap:anywhere] md:text-[17px]">
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
                                                                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-emerald-600"
                                                                    title="Suka jawaban ini"
                                                                    aria-label="Tandai jawaban ini membantu"
                                                                    aria-pressed={
                                                                        msgFeedback[
                                                                            message
                                                                                .id
                                                                        ] ===
                                                                        'like'
                                                                    }
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
                                                                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-rose-600"
                                                                    title="Tidak suka jawaban ini"
                                                                    aria-label="Tandai jawaban ini kurang membantu"
                                                                    aria-pressed={
                                                                        msgFeedback[
                                                                            message
                                                                                .id
                                                                        ] ===
                                                                        'dislike'
                                                                    }
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
                                                            {msgFeedback[
                                                                message.id
                                                            ] === 'dislike' &&
                                                                feedbackReasons[
                                                                    message.id
                                                                ] && (
                                                                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                                                                        {
                                                                            feedbackReasons[
                                                                                message
                                                                                    .id
                                                                            ]
                                                                        }
                                                                    </span>
                                                                )}
                                                        </div>

                                                        {/* Dive Deeper (Follow-up suggestions) */}
                                                        {isLastMessage &&
                                                            !isGenerating && (
                                                                <div className="animate-fade-in mt-5 border-t border-slate-100/50 pt-4">
                                                                    <span className="mb-2.5 block text-[10px] font-bold tracking-widest text-slate-400/80 uppercase">
                                                                        Pertanyaan
                                                                        lanjutan
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
                                                                                    className="cursor-pointer rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm transition-all duration-250 hover:border-blue-500 hover:bg-blue-50/20 hover:text-blue-600 active:scale-95 md:text-sm"
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
                                            <div className="flex w-full items-start gap-3 md:gap-4">
                                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white shadow-sm md:h-9 md:w-9">
                                                    <DekaLogo className="h-6 w-6 object-contain" />
                                                </div>
                                                <div className="w-fit rounded-2xl rounded-tl-sm border border-slate-200/75 bg-white/88 px-4 py-3 shadow-sm shadow-slate-200/50 backdrop-blur">
                                                    <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-500 md:text-[15px]">
                                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500/70 md:h-4.5 md:w-4.5" />
                                                        <span>
                                                            Sedang menyiapkan
                                                            jawaban...
                                                        </span>
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
                    <div className="relative bg-linear-to-t from-[#f8fbff] via-[#f8fbff]/95 to-transparent p-4">
                        <div className="mx-auto w-full max-w-3xl">
                            {chatError && (
                                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">
                                            {chatError}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setChatError(null)}
                                        className="cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                        aria-label="Tutup pesan error"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            )}
                            <div className="relative flex min-w-0 items-end gap-2 rounded-[28px] border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.7),0_1px_0_rgba(255,255,255,0.9)_inset] backdrop-blur transition-all duration-300 focus-within:border-blue-500/80 focus-within:ring-4 focus-within:ring-blue-500/10">
                                {/* Central textarea */}
                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) =>
                                        setInputValue(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tulis pertanyaan tentang DEKA di sini..."
                                    rows={1}
                                    disabled={isGenerating}
                                    className="text-wrap-anywhere max-h-[120px] min-h-[40px] min-w-0 flex-1 resize-none scrollbar-none bg-transparent py-2.5 pr-2 pl-4 text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-70 md:text-base md:leading-6"
                                />

                                {/* Right action buttons: Send button */}
                                <div className="flex shrink-0 items-end pr-1 pb-0.5">
                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={
                                            !inputValue.trim() || isGenerating
                                        }
                                        className="inline-flex h-9.5 w-9.5 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-95 disabled:cursor-not-allowed disabled:bg-blue-600/40 disabled:text-white/60 disabled:shadow-none"
                                        aria-label="Kirim pesan"
                                    >
                                        <SendHorizontal className="h-4.5 w-4.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="mt-2.5 text-center text-[10px] font-medium text-slate-500 md:text-xs">
                                Asisten AI Deka dapat membuat kesalahan.
                                Pertimbangkan untuk memeriksa informasi penting.
                            </p>
                        </div>
                    </div>
                    <SettingsModal
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                    />
                    {dislikeDialogMessageId !== null && (
                        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1.5px]">
                            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">
                                        Kenapa jawabannya kurang membantu?
                                    </h2>
                                    <p className="mt-1 text-sm leading-5 text-slate-500">
                                        Alasan ini membantu admin memperbaiki
                                        kualitas jawaban AI.
                                    </p>
                                </div>

                                <div className="mt-4 grid gap-2">
                                    {dislikeReasonOptions.map((reason) => (
                                        <button
                                            key={reason}
                                            type="button"
                                            onClick={() =>
                                                setDislikeReason(reason)
                                            }
                                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                                dislikeReason === reason
                                                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={dislikeReason}
                                    onChange={(event) =>
                                        setDislikeReason(event.target.value)
                                    }
                                    rows={3}
                                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-500/10"
                                    placeholder="Tulis alasan lain..."
                                />

                                <div className="mt-4 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDislikeDialogMessageId(null);
                                            setDislikeReason('');
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitDislikeReason}
                                        disabled={!dislikeReason.trim()}
                                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300"
                                    >
                                        Kirim feedback
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {renameTarget && (
                        <div className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-[1.5px] duration-200 fade-in">
                            <div className="w-full max-w-[420px] animate-in rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl duration-200 zoom-in-95">
                                <h3 className="text-center text-[20px] font-bold tracking-tight text-slate-900">
                                    Ubah judul percakapan
                                </h3>
                                <p className="mt-2 text-center text-sm text-slate-500">
                                    Judul ini hanya tampil di riwayat chat Anda.
                                </p>
                                <input
                                    value={renameTitle}
                                    onChange={(event) =>
                                        setRenameTitle(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            void handleRenameConversation();
                                        }
                                    }}
                                    maxLength={120}
                                    autoFocus
                                    className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                    placeholder="Judul percakapan"
                                />
                                <div className="mt-5 flex flex-col gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleRenameConversation()
                                        }
                                        disabled={
                                            isRenaming ||
                                            renameTitle.trim() === ''
                                        }
                                        className="w-full cursor-pointer rounded-full bg-blue-600 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                                    >
                                        {isRenaming
                                            ? 'Menyimpan...'
                                            : 'Simpan judul'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRenameTarget(null);
                                            setRenameTitle('');
                                        }}
                                        disabled={isRenaming}
                                        className="w-full cursor-pointer rounded-full border border-slate-200 bg-white py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {deleteTarget && (
                        <div className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-[1.5px] duration-200 fade-in">
                            <div className="w-full max-w-[420px] animate-in rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl duration-200 zoom-in-95">
                                <h3 className="text-center text-[20px] font-bold tracking-tight text-slate-900">
                                    Hapus percakapan?
                                </h3>
                                <p className="mt-2 text-center text-sm text-slate-500">
                                    Riwayat dan pesan di percakapan ini akan
                                    dihapus permanen.
                                </p>
                                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {deleteTarget.title ||
                                            'Percakapan Tanpa Judul'}
                                    </p>
                                </div>
                                <div className="mt-5 flex flex-col gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleDeleteConversation()
                                        }
                                        disabled={
                                            deletingConversationId ===
                                            deleteTarget.id
                                        }
                                        className="w-full cursor-pointer rounded-full bg-rose-600 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300"
                                    >
                                        {deletingConversationId ===
                                        deleteTarget.id
                                            ? 'Menghapus...'
                                            : 'Ya, hapus'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(null)}
                                        disabled={
                                            deletingConversationId ===
                                            deleteTarget.id
                                        }
                                        className="w-full cursor-pointer rounded-full border border-slate-200 bg-white py-3.5 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
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
    // Regex for markdown links, bold (**text**), italic (*text*), and inline code (`code`)
    const parts = text.split(
        /(\[[^\]]+\]\([^)]+\)|\*\*.*?\*\*|\*.*?\*|`.*?`)/g,
    );

    return parts.map((part, index) => {
        const markdownLink = extractMarkdownLink(part);

        if (markdownLink) {
            const { label, href } = markdownLink;

            if (isGoogleMapsUrl(href)) {
                return renderMapsPreview(`map-inline-${index}`, href, label);
            }

            return (
                <a
                    key={index}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 underline underline-offset-3 transition hover:text-blue-500"
                >
                    {label}
                </a>
            );
        }

        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={index} className="font-extrabold text-slate-950">
                    {part.slice(2, -2)}
                </strong>
            );
        }

        if (part.startsWith('*') && part.endsWith('*')) {
            return (
                <em key={index} className="text-slate-800 italic">
                    {part.slice(1, -1)}
                </em>
            );
        }

        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code
                    key={index}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-rose-600"
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
                    className="text-wrap-anywhere my-3 ml-4 list-inside list-disc space-y-1.5 text-base text-slate-800 md:text-[17px]"
                >
                    {currentList.items}
                </ul>,
            );
        } else {
            elements.push(
                <ol
                    key={`ol-${key}`}
                    className="text-wrap-anywhere my-3 ml-4 list-inside list-decimal space-y-1.5 text-base text-slate-800 md:text-[17px]"
                >
                    {currentList.items}
                </ol>,
            );
        }

        currentList = null;
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const lineLink = extractMarkdownLink(trimmed);
        const mapsLineMatch = trimmed.match(
            /^(?:\*\*)?(Google Maps|Maps|Lokasi)(?:\*\*)?:\s+(\[[^\]]+\]\([^)]+\))$/i,
        );

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
                    className="text-wrap-anywhere mt-4 mb-2 text-2xl font-black text-slate-900"
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
                    className="text-wrap-anywhere mt-4.5 mb-2 text-xl font-bold text-slate-900"
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
                    className="text-wrap-anywhere mt-4 mb-1.5 text-lg font-bold text-slate-900"
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
            const itemLink = extractMarkdownLink(cleanText);
            const itemMapsMatch = cleanText.match(
                /^(?:\*\*)?(Google Maps|Maps|Lokasi)(?:\*\*)?:\s+(\[[^\]]+\]\([^)]+\))$/i,
            );

            if (itemMapsMatch) {
                const mapLink = extractMarkdownLink(itemMapsMatch[2]);

                currentList.items.push(
                    <li key={`li-${idx}`} className="list-none leading-relaxed">
                        {mapLink
                            ? renderMapsPreview(
                                  `map-list-${idx}`,
                                  mapLink.href,
                                  mapLink.label,
                              )
                            : parseInline(cleanText)}
                    </li>,
                );

                return;
            }

            if (itemLink && isGoogleMapsUrl(itemLink.href)) {
                currentList.items.push(
                    <li key={`li-${idx}`} className="list-none leading-relaxed">
                        {renderMapsPreview(
                            `map-list-${idx}`,
                            itemLink.href,
                            itemLink.label,
                        )}
                    </li>,
                );

                return;
            }

            currentList.items.push(
                <li
                    key={`li-${idx}`}
                    className="text-wrap-anywhere leading-relaxed"
                >
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
                <li
                    key={`li-${idx}`}
                    className="text-wrap-anywhere leading-relaxed"
                >
                    {parseInline(cleanText)}
                </li>,
            );

            return;
        }

        if (mapsLineMatch) {
            const mapLink = extractMarkdownLink(mapsLineMatch[2]);

            flushList(idx);
            elements.push(
                mapLink ? (
                    renderMapsPreview(
                        `map-line-${idx}`,
                        mapLink.href,
                        mapLink.label,
                    )
                ) : (
                    <p
                        key={idx}
                        className="text-wrap-anywhere text-base leading-relaxed text-slate-800 md:text-[17px]"
                    >
                        {parseInline(line)}
                    </p>
                ),
            );

            return;
        }

        if (lineLink && isGoogleMapsUrl(lineLink.href)) {
            flushList(idx);
            elements.push(
                renderMapsPreview(
                    `map-line-${idx}`,
                    lineLink.href,
                    lineLink.label,
                ),
            );

            return;
        }

        const bareMapsUrl = trimmed.match(
            /^(https:\/\/(?:maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|www\.google\.[^/\s]+\/maps)[^\s]*)$/i,
        );

        if (bareMapsUrl) {
            flushList(idx);
            elements.push(
                renderMapsPreview(
                    `map-bare-${idx}`,
                    bareMapsUrl[1],
                    'Buka di Google Maps',
                ),
            );

            return;
        }

        // Regular text line
        flushList(idx);
        elements.push(
            <p
                key={idx}
                className="text-wrap-anywhere text-base leading-relaxed text-slate-800 md:text-[17px]"
            >
                {parseInline(line)}
            </p>,
        );
    });

    // Flush any remaining list
    flushList(lines.length);

    return <div className="text-wrap-anywhere space-y-1.5">{elements}</div>;
};
