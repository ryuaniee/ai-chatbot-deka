import { useEffect, useRef, useState } from 'react';
import { Head, usePage, useHttp } from '@inertiajs/react';
import { 
    Plus, 
    MessageSquare, 
    Menu, 
    X,
    Paperclip,
    Mic,
    ChevronDown,
    SendHorizontal
} from 'lucide-react';
import DekaLogo from '@/components/deka-logo';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { index as getConversations, store as createConversation, show as getConversation } from '@/routes/api/conversations';
import { store as createMessage } from '@/routes/api/conversations/messages';

interface ConversationItem {
    id: number;
    title: string;
    status: string;
    last_message_at: string;
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
}

export default function ChatPage() {
    const { auth } = usePage().props;
    const { submit } = useHttp();
    const messageForm = useHttp({ content: '' });
    const newConversationForm = useHttp({ content: '' });

    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const user = auth.user;

    // Fetch conversations on load
    useEffect(() => {
        fetchConversations();
    }, []);

    // Scroll to bottom whenever messages or generation state changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    const fetchConversations = () => {
        submit(getConversations())
            .then((res: any) => {
                setConversations(res.data || []);
            })
            .catch((err) => {
                console.error('Failed to fetch conversations:', err);
            });
    };

    const handleSelectConversation = (id: number) => {
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
        setActiveConversationId(null);
        setMessages([]);
        setInputValue('');
        setIsGenerating(false);
        setSidebarOpen(false);
    };

    const handleSendMessage = async (customText?: string) => {
        const text = (customText || inputValue).trim();
        if (!text || isGenerating) return;

        // Clear input value if sending from input box
        if (!customText) {
            setInputValue('');
        }

        setIsGenerating(true);

        // If there's no active conversation, create a new one first
        if (activeConversationId === null) {
            // Optimistically add user message to feed
            const tempUserMsg: MessageItem = { 
                id: Date.now(), 
                conversation_id: 0,
                reply_to_message_id: null,
                role: 'user', 
                content: text,
                sequence: 1,
                created_at: new Date().toISOString()
            };
            setMessages([tempUserMsg]);

            newConversationForm.setData('content', text);
            newConversationForm.post(createConversation.url())
                .then((res: any) => {
                    if (res.conversation) {
                        setActiveConversationId(res.conversation.id);
                        fetchConversations();
                    }
                    const newMsgs: MessageItem[] = [];
                    if (res.user_message) newMsgs.push(res.user_message);
                    if (res.assistant_message) newMsgs.push(res.assistant_message);
                    setMessages(newMsgs);
                    setIsGenerating(false);
                })
                .catch((err) => {
                    console.error('Failed to create conversation:', err);
                    setIsGenerating(false);
                });
        } else {
            // Append user message immediately
            const userMsg: MessageItem = { 
                id: Date.now(), 
                conversation_id: activeConversationId,
                reply_to_message_id: null,
                role: 'user', 
                content: text,
                sequence: messages.length + 1,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, userMsg]);

            messageForm.setData('content', text);
            messageForm.post(createMessage.url(activeConversationId))
                .then((res: any) => {
                    if (res.assistant_message) {
                        setMessages(prev => [...prev, res.assistant_message]);
                    }
                    fetchConversations();
                    setIsGenerating(false);
                })
                .catch((err) => {
                    console.error('Failed to send message:', err);
                    setIsGenerating(false);
                });
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

            <div className="flex h-screen w-screen bg-white text-stone-800 overflow-hidden font-sans relative">
                {/* Mobile sidebar backdrop */}
                {sidebarOpen && (
                    <div 
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity" 
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Left Sidebar */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#f9f9fb] border-r border-stone-200/80 transition-transform duration-300 lg:static lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between p-4 border-b border-stone-200/50">
                        <div className="flex items-center gap-2">
                            <DekaLogo className="h-9 w-auto object-contain" />
                            <span className="font-extrabold text-stone-800 tracking-tight text-lg">Deka Chat</span>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-stone-200/50 rounded-lg text-stone-500 cursor-pointer">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* New Chat Button */}
                    <div className="p-4">
                        <button 
                            onClick={handleNewChat}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm cursor-pointer"
                        >
                            <Plus className="h-4 w-4 text-[#2f80ed]" />
                            Percakapan Baru
                        </button>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1" style={{ scrollbarWidth: 'none' }}>
                        <p className="px-3 text-xs font-bold uppercase tracking-[0.1em] text-stone-400 mb-2">
                            Riwayat Chat
                        </p>
                        {conversations.length === 0 ? (
                            <p className="px-3 text-xs text-stone-400 italic">Belum ada percakapan</p>
                        ) : (
                            conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv.id)}
                                    className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition cursor-pointer border ${
                                        activeConversationId === conv.id
                                            ? 'bg-blue-50/70 border-blue-100/50 text-[#2f80ed] font-semibold'
                                            : 'bg-transparent border-transparent hover:bg-stone-200/40 text-stone-600'
                                    }`}
                                >
                                    <MessageSquare className={`h-4 w-4 shrink-0 ${activeConversationId === conv.id ? 'text-[#2f80ed]' : 'text-stone-400'}`} />
                                    <span className="truncate flex-1">{conv.title || 'Percakapan Tanpa Judul'}</span>
                                </button>
                              ))
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    {user && (
                        <div className="p-4 border-t border-stone-200/50 bg-stone-50/80">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-stone-200/50 transition text-left cursor-pointer border border-transparent hover:border-stone-200 outline-none">
                                        <UserInfo user={user} />
                                        <ChevronDown className="ml-auto size-4 text-stone-400" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64 rounded-xl p-1.5 shadow-lg border border-stone-200" align="start" side="top">
                                    <UserMenuContent user={user} />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
                    {/* Top Header Bar */}
                    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-100 bg-white px-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-stone-100 rounded-lg text-stone-500 cursor-pointer">
                                <Menu className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-50 border border-stone-100 text-xs font-semibold text-stone-600">
                                <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                                Deka Assistant Online
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                        </div>
                    </header>

                    {/* Chat Feed */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
                                <DekaLogo className="h-20 w-auto object-contain mb-6 animate-pulse" />
                                <h2 className="text-3xl font-extrabold tracking-tight text-stone-800 mb-2">
                                    Ada yang bisa saya bantu hari ini?
                                </h2>
                                <p className="text-sm text-stone-500 mb-8 max-w-md">
                                    Tanyakan apa saja seputar Deka, layanan kami, alamat, kontak, atau informasi lainnya.
                                </p>

                                {/* Suggestion Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
                                    <button
                                        onClick={() => handleSendMessage('Apa itu Deka?')}
                                        className="flex flex-col items-start p-4 rounded-2xl border border-stone-200 hover:border-blue-450 hover:bg-blue-50/20 text-left transition shadow-sm cursor-pointer"
                                    >
                                        <span className="font-semibold text-sm text-stone-700">Apa itu Deka?</span>
                                        <span className="text-xs text-stone-400 mt-1">Cari tahu informasi dasar mengenai Deka.</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage('Layanan Deka')}
                                        className="flex flex-col items-start p-4 rounded-2xl border border-stone-200 hover:border-blue-450 hover:bg-blue-50/20 text-left transition shadow-sm cursor-pointer"
                                    >
                                        <span className="font-semibold text-sm text-stone-700">Layanan Deka</span>
                                        <span className="text-xs text-stone-400 mt-1">Pelajari layanan dan produk yang kami sediakan.</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage('Kontak dan alamat')}
                                        className="flex flex-col items-start p-4 rounded-2xl border border-stone-200 hover:border-blue-450 hover:bg-blue-50/20 text-left transition shadow-sm cursor-pointer"
                                    >
                                        <span className="font-semibold text-sm text-stone-700">Kontak & Alamat</span>
                                        <span className="text-xs text-stone-400 mt-1">Dapatkan nomor telepon, email, dan alamat kantor.</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage('Fitur chatbot ini')}
                                        className="flex flex-col items-start p-4 rounded-2xl border border-stone-200 hover:border-blue-450 hover:bg-blue-50/20 text-left transition shadow-sm cursor-pointer"
                                    >
                                        <span className="font-semibold text-sm text-stone-700">Fitur Chatbot</span>
                                        <span className="text-xs text-stone-400 mt-1">Ketahui kemampuan asisten AI dalam membantu Anda.</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 px-4 md:px-6 space-y-6">
                                {messages.map((message) => (
                                    <div key={message.id} className="max-w-3xl mx-auto w-full animate-fade-in">
                                        {message.role === 'user' ? (
                                            <div className="flex justify-end w-full">
                                                <div className="max-w-[80%] rounded-[2rem] bg-[#2f80ed] text-white px-5 py-3 text-sm md:text-base shadow-sm whitespace-pre-wrap">
                                                    {message.content}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-4 items-start w-full">
                                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 overflow-hidden shadow-inner">
                                                    <DekaLogo className="h-5 w-5 object-contain" />
                                                </div>
                                                <div className="flex-1 bg-stone-50/70 border border-stone-100 rounded-[1.5rem] px-5 py-3.5 text-sm md:text-base shadow-sm whitespace-pre-wrap text-stone-800 leading-relaxed">
                                                    {message.content}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Typing Indicator */}
                                {isGenerating && (
                                    <div className="max-w-3xl mx-auto w-full">
                                        <div className="flex gap-4 items-start w-full">
                                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 overflow-hidden shadow-inner">
                                                <DekaLogo className="h-5 w-5 object-contain" />
                                            </div>
                                            <div className="flex-1 bg-stone-50/70 border border-stone-100 rounded-[1.5rem] px-5 py-4 shadow-sm w-fit">
                                                <div className="flex gap-1 items-center">
                                                    <span className="h-2 w-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                    <span className="h-2 w-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                    <span className="h-2 w-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
                    <div className="bg-white border-t border-stone-100/50 p-4">
                        <div className="max-w-3xl mx-auto w-full">
                            <div className="relative flex flex-col rounded-3xl border border-stone-200 bg-stone-50 shadow-sm focus-within:border-stone-400 focus-within:ring-1 focus-within:ring-stone-400 p-1.5 transition">
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tulis pertanyaan tentang Deka di sini..."
                                    rows={1}
                                    className="w-full resize-none bg-transparent py-2.5 px-4 text-sm md:text-base outline-none max-h-36 min-h-[40px] text-stone-800 scrollbar-none"
                                />
                                <div className="flex justify-between items-center px-2 pt-1 border-t border-stone-100/50 mt-1">
                                    <div className="flex gap-1">
                                        <button type="button" className="text-stone-400 hover:text-stone-600 p-2 rounded-full hover:bg-stone-200/40 transition cursor-pointer">
                                            <Paperclip className="h-4 w-4" />
                                        </button>
                                        <button type="button" className="text-stone-400 hover:text-stone-600 p-2 rounded-full hover:bg-stone-200/40 transition cursor-pointer">
                                            <Mic className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={!inputValue.trim() || isGenerating}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2f80ed] hover:bg-blue-600 text-white disabled:bg-stone-200 disabled:text-stone-400 transition cursor-pointer shadow-sm"
                                    >
                                        <SendHorizontal className="h-4.5 w-4.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] md:text-xs text-stone-400 text-center mt-2.5">
                                Asisten AI Deka dapat membuat kesalahan. Pertimbangkan untuk memeriksa informasi penting.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
