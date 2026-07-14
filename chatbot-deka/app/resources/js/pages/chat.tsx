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
    SendHorizontal,
    HelpCircle,
    Sparkles,
    Phone,
    Info
} from 'lucide-react';
import DekaLogo from '@/components/deka-logo';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import SettingsModal from '@/components/settings-modal';
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
    const [settingsOpen, setSettingsOpen] = useState(false);

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

             <div className="flex h-screen w-screen bg-white text-slate-800 overflow-hidden font-sans relative">
                {/* Mobile sidebar backdrop */}
                {sidebarOpen && (
                    <div 
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity" 
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Left Sidebar */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-50 border-r border-slate-200/80 transition-transform duration-300 lg:static lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200/50">
                        <div className="flex items-center gap-2">
                            <DekaLogo className="h-9 w-auto object-contain" />
                            <span className="font-extrabold text-blue-600 tracking-tight text-lg">Deka Chat</span>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-200/50 rounded-lg text-slate-500 cursor-pointer">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* New Chat Button */}
                    <div className="p-4">
                        <button 
                            onClick={handleNewChat}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-200 px-4 py-3 text-sm font-bold cursor-pointer"
                        >
                            <Plus className="h-4 w-4 text-white" />
                            Percakapan Baru
                        </button>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1" style={{ scrollbarWidth: 'none' }}>
                        <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
                            Riwayat Chat
                        </p>
                        {conversations.length === 0 ? (
                            <p className="px-3 text-xs text-slate-400 italic">Belum ada percakapan</p>
                        ) : (
                            conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv.id)}
                                    className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition cursor-pointer border-l-4 ${
                                        activeConversationId === conv.id
                                            ? 'bg-blue-50 border-l-blue-600 border-y-transparent border-r-transparent text-blue-600 font-bold'
                                            : 'bg-transparent border-l-transparent border-y-transparent border-r-transparent hover:bg-slate-200/40 text-slate-600'
                                    }`}
                                >
                                    <MessageSquare className={`h-4 w-4 shrink-0 ${activeConversationId === conv.id ? 'text-blue-600' : 'text-slate-450'}`} />
                                    <span className="truncate flex-1">{conv.title || 'Percakapan Tanpa Judul'}</span>
                                </button>
                              ))
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    {user && (
                        <div className="p-4 border-t border-slate-200/50 bg-slate-50">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-slate-200/40 transition text-left cursor-pointer border border-transparent hover:border-slate-200 outline-none">
                                        <UserInfo user={user} />
                                        <ChevronDown className="ml-auto size-4 text-slate-400" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64 rounded-xl p-1.5 shadow-lg border border-slate-200" align="start" side="top">
                                    <UserMenuContent user={user} onSettingsClick={() => setSettingsOpen(true)} />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
                    {/* Top Header Bar */}
                    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
                                <Menu className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                        </div>
                    </header>

                    {/* Chat Feed */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
                                <div className="p-3 bg-slate-100/80 rounded-full border border-slate-200/50 mb-6">
                                    <DekaLogo className="h-16 w-auto object-contain" />
                                </div>
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-blue-600 mb-3">
                                    Ada yang bisa saya bantu hari ini?
                                </h2>
                                <p className="text-sm md:text-base text-slate-500 mb-8 max-w-md leading-relaxed">
                                    Tanyakan apa saja seputar Deka, layanan kami, alamat, kontak, atau informasi lainnya.
                                </p>

                                {/* Suggestion Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full max-w-xl">
                                    <button
                                        onClick={() => handleSendMessage('Apa itu Deka?')}
                                        className="flex flex-col items-start p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
                                    >
                                        <HelpCircle className="h-5 w-5 text-blue-500 mb-2.5 group-hover:scale-110 transition-transform duration-200" />
                                        <span className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">Apa itu Deka?</span>
                                        <span className="text-xs text-slate-400 mt-1">Cari tahu informasi dasar mengenai Deka.</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage('Layanan Deka')}
                                        className="flex flex-col items-start p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
                                    >
                                        <Sparkles className="h-5 w-5 text-indigo-500 mb-2.5 group-hover:scale-110 transition-transform duration-200" />
                                        <span className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">Layanan Deka</span>
                                        <span className="text-xs text-slate-400 mt-1">Pelajari layanan dan produk yang kami sediakan.</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage('Kontak dan alamat')}
                                        className="flex flex-col items-start p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
                                    >
                                        <Phone className="h-5 w-5 text-emerald-500 mb-2.5 group-hover:scale-110 transition-transform duration-200" />
                                        <span className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">Kontak & Alamat</span>
                                        <span className="text-xs text-slate-400 mt-1">Dapatkan nomor telepon, email, dan alamat kantor.</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage('Fitur chatbot ini')}
                                        className="flex flex-col items-start p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer group"
                                    >
                                        <Info className="h-5 w-5 text-purple-500 mb-2.5 group-hover:scale-110 transition-transform duration-200" />
                                        <span className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors">Fitur Chatbot</span>
                                        <span className="text-xs text-slate-400 mt-1">Ketahui kemampuan asisten AI dalam membantu Anda.</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 px-4 md:px-6 space-y-6">
                                {messages.map((message) => (
                                    <div key={message.id} className="max-w-3xl mx-auto w-full animate-fade-in">
                                        {message.role === 'user' ? (
                                            <div className="flex justify-end w-full">
                                                <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-blue-600 text-white px-5 py-3 text-sm md:text-base shadow-sm whitespace-pre-wrap">
                                                    {message.content}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-4 items-start w-full">
                                                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-white flex items-center justify-center border border-slate-100 overflow-hidden shadow-sm">
                                                    <DekaLogo className="h-6 w-6 object-contain" />
                                                </div>
                                                <div className="flex-1 bg-white border border-slate-150/70 rounded-2xl rounded-tl-none px-5 py-4 text-sm md:text-base shadow-sm whitespace-pre-wrap text-slate-800 leading-relaxed">
                                                    {message.content}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Typing Indicator */}
                                {isGenerating && (
                                    <div className="max-w-3xl mx-auto w-full">
                                        <div className="flex gap-4 items-start w-full animate-pulse">
                                            <div className="flex-shrink-0 h-9 w-9 rounded-full bg-white flex items-center justify-center border border-slate-100 overflow-hidden shadow-sm">
                                                <DekaLogo className="h-6 w-6 object-contain" />
                                            </div>
                                            <div className="flex-1 bg-white border border-slate-150/70 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm w-fit max-w-[100px]">
                                                <div className="flex gap-1.5 items-center justify-center">
                                                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                    <span className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
                    <div className="bg-white border-t border-slate-100 p-4">
                        <div className="max-w-3xl mx-auto w-full">
                            <div className="relative flex flex-col rounded-3xl border border-slate-200 bg-white shadow-md shadow-slate-100/50 focus-within:border-blue-500/80 focus-within:ring-4 focus-within:ring-blue-500/10 p-2 transition-all duration-300">
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Tulis pertanyaan tentang Deka di sini..."
                                    rows={1}
                                    className="w-full resize-none bg-transparent py-2.5 px-4 text-sm md:text-base outline-none max-h-36 min-h-[40px] text-slate-800 scrollbar-none"
                                />
                                <div className="flex justify-between items-center px-2 pt-1.5 border-t border-slate-100 mt-1">
                                    <div className="flex gap-1">
                                        <button type="button" className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer">
                                            <Paperclip className="h-4.5 w-4.5" />
                                        </button>
                                        <button type="button" className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer">
                                            <Mic className="h-4.5 w-4.5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={!inputValue.trim() || isGenerating}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg active:scale-95"
                                    >
                                        <SendHorizontal className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] md:text-xs text-slate-400 text-center mt-2.5">
                                Asisten AI Deka dapat membuat kesalahan. Pertimbangkan untuk memeriksa informasi penting.
                            </p>
                        </div>
                    </div>
                    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
                </main>
            </div>
        </>
    );
}
