import { Head } from '@inertiajs/react';
import { Bot, MessageSquarePlus, PanelRight, SendHorizontal } from 'lucide-react';

const conversations = [
    'Apa itu Deka?',
    'Layanan Deka',
    'Kontak dan alamat',
];

const messages = [
    {
        role: 'user',
        content: 'Deka itu apa?',
    },
    {
        role: 'assistant',
        content: 'Deka adalah platform yang membantu pengguna memahami informasi dan layanan Deka secara ringkas.',
    },
];

export default function ChatPage() {
    return (
        <>
            <Head title="Chat" />

            <div className="flex h-full flex-1 gap-4 overflow-hidden rounded-3xl bg-[linear-gradient(180deg,#f7f1e8_0%,#fbf8f2_100%)] p-4 text-stone-900">
                <aside className="hidden w-72 shrink-0 rounded-2xl border border-stone-200 bg-white/90 p-4 lg:flex lg:flex-col">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                                Deka Chat
                            </p>
                            <h1 className="mt-1 text-lg font-semibold">Percakapan</h1>
                        </div>
                        <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-600">
                            <MessageSquarePlus className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-4 space-y-2">
                        {conversations.map((conversation, index) => (
                            <div
                                key={conversation}
                                className={`rounded-2xl border px-4 py-3 text-sm ${
                                    index === 0
                                        ? 'border-stone-900 bg-stone-900 text-white'
                                        : 'border-stone-200 bg-stone-50 text-stone-700'
                                }`}
                            >
                                {conversation}
                            </div>
                        ))}
                    </div>
                </aside>

                <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-stone-200 bg-white/92">
                    <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                                <Bot className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                                    Single Assistant
                                </p>
                                <h2 className="text-base font-semibold">Deka Assistant</h2>
                            </div>
                        </div>

                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-500">
                            <PanelRight className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            Wireframe backend handoff: area ini nanti diisi hasil API conversation dan message.
                        </div>

                        {messages.map((message) => (
                            <div
                                key={`${message.role}-${message.content}`}
                                className={`max-w-2xl rounded-3xl px-4 py-3 text-sm leading-6 ${
                                    message.role === 'user'
                                        ? 'ml-auto bg-stone-900 text-white'
                                        : 'bg-stone-100 text-stone-800'
                                }`}
                            >
                                {message.content}
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-stone-200 p-4">
                        <div className="flex items-end gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-3">
                            <textarea
                                className="min-h-20 flex-1 resize-none bg-transparent text-sm outline-none"
                                placeholder="Tulis pertanyaan tentang Deka di sini..."
                                readOnly
                            />
                            <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white">
                                <SendHorizontal className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

ChatPage.layout = {
    breadcrumbs: [
        {
            title: 'Chat',
            href: '/chat',
        },
    ],
};
