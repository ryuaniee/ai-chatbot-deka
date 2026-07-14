import { Head, Link, usePage } from '@inertiajs/react';
import { login, register } from '@/routes';
import DekaLogo from '@/components/deka-logo';
import { ArrowRight, MessageSquare, Info, Clock, Sparkles, LogIn, UserPlus } from 'lucide-react';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Selamat Datang" />
            <div className="min-h-screen bg-[#faf9f6] text-[#1b1b18] font-sans selection:bg-[#2f80ed]/20 selection:text-[#2f80ed]">
                {/* Header / Navbar */}
                <header className="sticky top-0 z-50 w-full border-b border-zinc-200/50 bg-[#faf9f6]/80 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl h-20 items-center justify-between px-6 lg:px-8">
                        <Link href="/" className="flex items-center h-20 w-56 relative">
                            <DekaLogo className="h-36 w-auto object-contain absolute left-0 top-1/2 -translate-y-1/2 max-w-none" />
                        </Link>
                        
                        <nav className="flex items-center gap-4">
                            {auth.user ? (
                                <Link
                                    href="/chat"
                                    className="flex items-center gap-2 rounded-xl bg-[#2f80ed] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-600 transition-all hover:shadow-lg hover:shadow-blue-500/20 active:scale-98"
                                >
                                    Mulai Chat <ArrowRight className="h-4 w-4" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-98 shadow-sm"
                                    >
                                        Masuk
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="rounded-xl bg-gradient-to-r from-[#2f80ed] to-[#1a73e8] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#1a73e8] hover:to-[#155fc4] transition-all hover:shadow-lg hover:shadow-blue-500/20 active:scale-98"
                                    >
                                        Daftar
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                {/* Hero Section */}
                <main className="mx-auto max-w-7xl px-6 lg:px-8 py-12 md:py-20 lg:py-24">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8 items-center">
                        {/* Text Block */}
                        <div className="flex flex-col items-start text-left gap-6">
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 leading-tight">
                                Asisten AI Pintar Layanan Informasi Deka
                            </h1>

                            <p className="text-base sm:text-lg text-zinc-600 max-w-xl leading-relaxed font-normal">
                                Selamat datang di Chatbot Deka! Layanan asisten virtual cerdas yang siap menjawab pertanyaan seputar informasi umum, lokasi, jadwal, hingga layanan Deka secara instan, 24/7.
                            </p>

                            <div className="flex flex-wrap items-center gap-4 mt-2">
                                {auth.user ? (
                                    <Link
                                        href="/chat"
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f80ed] to-[#1a73e8] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:from-[#1a73e8] hover:to-[#155fc4] transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-98"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                        Mulai Obrolan Sekarang
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href={login()}
                                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f80ed] to-[#1a73e8] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:from-[#1a73e8] hover:to-[#155fc4] transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-98"
                                        >
                                            <LogIn className="h-4 w-4" />
                                            Masuk ke Chatbot
                                        </Link>
                                        <Link
                                            href={register()}
                                            className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-900 transition-all active:scale-98 shadow-sm"
                                        >
                                            <UserPlus className="h-4 w-4" />
                                            Daftar Akun Baru
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Image Block */}
                        <div className="relative flex justify-center lg:justify-end">
                            {/* Decorative background effects */}
                            <div className="absolute -left-12 -top-12 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl -z-10" />
                            <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#2f80ed]/10 blur-3xl -z-10" />

                            <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-3 shadow-2xl transition-transform duration-500 hover:scale-[1.01] max-w-lg w-full">
                                <img
                                    src="/img/deka-screenshot.png"
                                    alt="Tampilan Antarmuka Deka Chatbot"
                                    className="rounded-2xl w-full h-[320px] sm:h-[380px] object-cover object-top"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Features section */}
                    <div className="mt-20 md:mt-28 border-t border-zinc-200/50 pt-16">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <h2 className="text-3xl font-bold tracking-tight text-zinc-950 font-serif">
                                Apa yang bisa dibantu oleh Chatbot Deka?
                            </h2>
                            <p className="mt-4 text-sm text-zinc-500">
                                Asisten cerdas kami siap menjawab dan memberikan bantuan untuk berbagai keperluan informasi Anda.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="flex flex-col items-start rounded-2xl bg-white border border-zinc-200/60 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f80ed]/10 text-[#2f80ed] mb-4">
                                    <Info className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold text-zinc-900 mb-2">Informasi Umum</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Tanyakan profil lengkap, jenis layanan, kontak resmi, hingga info terbaru mengenai Deka.
                                </p>
                            </div>

                            <div className="flex flex-col items-start rounded-2xl bg-white border border-zinc-200/60 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f80ed]/10 text-[#2f80ed] mb-4">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold text-zinc-900 mb-2">Jadwal & Fasilitas</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Dapatkan informasi lokasi presisi, peta, serta fasilitas operasional yang tersedia di Deka.
                                </p>
                            </div>

                            <div className="flex flex-col items-start rounded-2xl bg-white border border-zinc-200/60 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f80ed]/10 text-[#2f80ed] mb-4">
                                    <MessageSquare className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold text-zinc-900 mb-2">Obrolan Instan 24/7</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Asisten AI yang siap melayani Anda kapan saja tanpa antre dan tanpa menunggu lama.
                                </p>
                            </div>

                            <div className="flex flex-col items-start rounded-2xl bg-white border border-zinc-200/60 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f80ed]/10 text-[#2f80ed] mb-4">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <h3 className="text-base font-bold text-zinc-900 mb-2">Teknologi AI Terkini</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Didukung dengan pemrosesan bahasa alami yang cerdas dan akurat untuk kenyamanan Anda.
                                </p>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-white border-t border-zinc-200/50 py-8 mt-16">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                        <p className="text-xs text-zinc-500">
                            &copy; {new Date().getFullYear()} Deka Coffee & Arts Studio. All rights reserved.
                        </p>
                        <p className="text-xs text-zinc-400">
                            Powered by Deka Chatbot AI Engine
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
}
