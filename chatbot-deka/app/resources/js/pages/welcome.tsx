import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Clock,
    Info,
    LogIn,
    MapPin,
    MessageSquare,
    ShieldCheck,
    Sparkles,
    UserPlus,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import DekaLogo from '@/components/deka-logo';
import { login, register } from '@/routes';

function InteractiveCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const container = canvas.parentElement;
        if (!container) return;

        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        interface Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;
            color: string;
            baseAlpha: number;
            alpha: number;
            speedMultiplier: number;
        }

        interface StrokeParticle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;
            color: string;
            alpha: number;
            decay: number;
        }

        const COLORS = [
            'rgba(37, 99, 235, ',   // Blue
            'rgba(180, 83, 9, ',    // Dark Coffee Amber
            'rgba(217, 119, 6, ',   // Rich Gold
        ];

        const particles: Particle[] = [];
        const strokeParticles: StrokeParticle[] = [];

        // Initialize ambient particles
        const particleCount = 45;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                radius: Math.random() * 5 + 1.5,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                baseAlpha: Math.random() * 0.35 + 0.15,
                alpha: 0,
                speedMultiplier: Math.random() * 0.6 + 0.4
            });
        }

        const mouse = { x: 0, y: 0, active: false, lastX: 0, lastY: 0 };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (!mouse.active) {
                mouse.lastX = x;
                mouse.lastY = y;
                mouse.active = true;
            }

            mouse.x = x;
            mouse.y = y;

            const dx = mouse.x - mouse.lastX;
            const dy = mouse.y - mouse.lastY;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d > 1) {
                const steps = Math.min(4, Math.floor(d / 3) + 1);
                for (let k = 0; k < steps; k++) {
                    const ratio = k / steps;
                    const px = mouse.lastX + dx * ratio;
                    const py = mouse.lastY + dy * ratio;

                    strokeParticles.push({
                        x: px + (Math.random() - 0.5) * 6,
                        y: py + (Math.random() - 0.5) * 6,
                        vx: (Math.random() - 0.5) * 0.4 + (dx * 0.02),
                        vy: (Math.random() - 0.5) * 0.4 + (dy * 0.02),
                        radius: Math.random() * 10 + 6,
                        color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        alpha: 0.6,
                        decay: Math.random() * 0.012 + 0.008
                    });
                }
                mouse.lastX = mouse.x;
                mouse.lastY = mouse.y;
            }
        };

        const handleMouseLeave = () => {
            mouse.active = false;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                const rect = container.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;

                if (!mouse.active) {
                    mouse.lastX = x;
                    mouse.lastY = y;
                    mouse.active = true;
                }

                mouse.x = x;
                mouse.y = y;

                const dx = mouse.x - mouse.lastX;
                const dy = mouse.y - mouse.lastY;
                const d = Math.sqrt(dx * dx + dy * dy);

                if (d > 1) {
                    const steps = Math.min(4, Math.floor(d / 3) + 1);
                    for (let k = 0; k < steps; k++) {
                        const ratio = k / steps;
                        const px = mouse.lastX + dx * ratio;
                        const py = mouse.lastY + dy * ratio;

                        strokeParticles.push({
                            x: px + (Math.random() - 0.5) * 6,
                            y: py + (Math.random() - 0.5) * 6,
                            vx: (Math.random() - 0.5) * 0.4 + (dx * 0.02),
                            vy: (Math.random() - 0.5) * 0.4 + (dy * 0.02),
                            radius: Math.random() * 10 + 6,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                            alpha: 0.6,
                            decay: Math.random() * 0.012 + 0.008
                        });
                    }
                    mouse.lastX = mouse.x;
                    mouse.lastY = mouse.y;
                }
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleMouseLeave);

        let animationFrameId: number;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update & Draw Ambient Particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx * p.speedMultiplier;
                p.y += p.vy * p.speedMultiplier;

                // Wrap boundaries
                if (p.x < -p.radius) p.x = canvas.width + p.radius;
                if (p.x > canvas.width + p.radius) p.x = -p.radius;
                if (p.y < -p.radius) p.y = canvas.height + p.radius;
                if (p.y > canvas.height + p.radius) p.y = -p.radius;

                // Mouse interaction
                if (mouse.active) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 180) {
                        const force = ((180 - dist) / 180) * 0.025;
                        p.vx += (dx / dist) * force;
                        p.vy += (dy / dist) * force;
                    }
                }

                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > 0.8) {
                    p.vx = (p.vx / speed) * 0.8;
                    p.vy = (p.vy / speed) * 0.8;
                }

                if (p.alpha < p.baseAlpha) {
                    p.alpha += 0.01;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color + p.alpha + ')';
                ctx.fill();
            }

            // Update & Draw Mouse Stroke Particles
            for (let i = strokeParticles.length - 1; i >= 0; i--) {
                const p = strokeParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.025; // Dripping paint effect
                p.alpha -= p.decay;
                p.radius += 0.12;

                if (p.alpha <= 0) {
                    strokeParticles.splice(i, 1);
                    continue;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color + p.alpha + ')';
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 h-full w-full pointer-events-none"
        />
    );
}

const featureItems = [
    {
        icon: Info,
        title: 'Info layanan Deka',
        description:
            'Tanyakan profil, layanan, fasilitas, dan informasi umum yang dibutuhkan sebelum berkunjung.',
    },
    {
        icon: MapPin,
        title: 'Lokasi dan kontak',
        description:
            'Temukan alamat, kontak resmi, serta arahan informasi yang membantu Anda terhubung lebih cepat.',
    },
    {
        icon: Clock,
        title: 'Jadwal dan operasional',
        description:
            'Dapatkan ringkasan informasi waktu layanan dan ketersediaan fasilitas secara praktis.',
    },
    {
        icon: MessageSquare,
        title: 'Riwayat chat tersimpan',
        description:
            'Percakapan yang sudah dibuat tetap tersedia, jadi pertanyaan sebelumnya mudah dibuka kembali.',
    },
];

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Selamat Datang" />
            <div className="min-h-screen bg-[#f7f7f4] font-sans text-slate-950 selection:bg-blue-600/20 selection:text-blue-700">
                <main>
                    <section
                        className="relative overflow-hidden border-b border-slate-200/70 bg-[#f7f7f4] min-h-screen"
                    >
                        {/* Latar Belakang Seni Sapuan Kuas Abstrak (Arts Studio Theme) */}
                        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
                            {/* Glow radial di tengah untuk kontras teks */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.75)_0%,rgba(247,247,244,0.3)_80%)]" />

                            <InteractiveCanvas />

                            {/* Overlay gradien tambahan untuk transisi mulus ke bagian berikutnya */}
                            <div className="absolute right-0 bottom-0 left-0 h-32 bg-gradient-to-t from-[#f7f7f4] to-transparent" />
                        </div>

                        <div
                            className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 md:px-8"
                        >
                            <div className="z-10 flex max-w-3xl flex-col items-center justify-center space-y-8 text-center py-12">
                                <div className="flex flex-col items-center mb-6 mt-[-2.5rem] md:mt-[-5rem]">
                                    <Link
                                        href="/"
                                        className="flex items-center justify-center overflow-visible transition hover:opacity-90"
                                    >
                                        <DekaLogo className="h-24 md:h-32 w-auto object-contain" />
                                    </Link>
                                </div>

                                <h1
                                    className="text-center leading-[1.1] font-extrabold tracking-tight text-slate-950"
                                    style={{
                                        fontSize: 'clamp(3rem, 5.5vw, 5.25rem)',
                                    }}
                                >
                                    Tanya{' '}
                                    <span className="font-black text-blue-500">
                                        Deka
                                    </span>
                                    ,<br />
                                    dapat jawaban cepat.
                                </h1>

                                <p className="max-w-2xl text-center text-base leading-relaxed text-slate-600 md:text-lg">
                                    Chatbot pintar kami siap memberikan info
                                    menu, rute lokasi, fasilitas, hingga jadwal
                                    operasional Deka Coffee & Arts Studio secara
                                    instan.
                                </p>

                                <div className="flex w-full flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
                                    {auth.user ? (
                                        <Link
                                            href="/chat"
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition duration-300 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-98 sm:w-auto"
                                        >
                                            <MessageSquare className="h-5 w-5" />
                                            Mulai Chat Sekarang
                                        </Link>
                                    ) : (
                                        <Link
                                            href={login()}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition duration-300 hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-98 sm:w-auto"
                                        >
                                            <MessageSquare className="h-5 w-5" />
                                            Mulai Bertanya
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section
                        id="fitur"
                        className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24"
                    >
                        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
                            <div>
                                <p className="text-sm font-bold text-blue-600 uppercase">
                                    Yang bisa dibantu
                                </p>
                                <h2 className="mt-3 max-w-xl text-3xl leading-tight font-black tracking-normal text-slate-950 md:text-5xl">
                                    Informasi penting Deka dalam alur chat yang
                                    ringan.
                                </h2>
                            </div>
                            <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-lg md:leading-8">
                                Gunakan chatbot untuk mencari informasi yang
                                sering ditanyakan tanpa perlu berpindah halaman.
                                Jawaban tetap mudah dibaca, ringkas, dan
                                tersimpan dalam riwayat percakapan.
                            </p>
                        </div>

                        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {featureItems.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <article
                                        key={item.title}
                                        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                                    >
                                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-bold text-slate-950">
                                            {item.title}
                                        </h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            {item.description}
                                        </p>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                </main>

                <footer id="kontak" className="bg-[#f7f7f4] py-8">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-center md:flex-row md:px-8 md:text-left">
                        <p className="text-xs text-slate-500">
                            &copy; {new Date().getFullYear()} Deka Coffee & Arts
                            Studio. All rights reserved.
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                            Powered by Deka Chatbot AI Engine
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
}
