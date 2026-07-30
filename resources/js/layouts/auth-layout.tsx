import { Link } from '@inertiajs/react';
import { Home } from 'lucide-react';
import DekaLogo from '@/components/deka-logo';
import { home } from '@/routes';

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#eef5ff] px-4 py-6 text-slate-950 sm:px-6 md:py-8">
            <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
                <div
                    className="absolute inset-0 opacity-[0.28]"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(47, 128, 237, 0.62) 1px, transparent 0), linear-gradient(135deg, rgba(37, 99, 235, 0.16) 1px, transparent 1px), linear-gradient(45deg, rgba(14, 165, 233, 0.1) 1px, transparent 1px)',
                        backgroundSize: '24px 24px, 56px 56px, 112px 112px',
                    }}
                />
                <div className="absolute -top-24 left-[7%] h-80 w-80 rounded-full bg-blue-300/32 blur-3xl" />
                <div className="absolute top-[14%] right-[8%] h-[28rem] w-[28rem] rounded-full bg-cyan-200/34 blur-3xl" />
                <div className="absolute bottom-[-8rem] left-[20%] h-96 w-[42rem] rounded-full bg-indigo-300/24 blur-3xl" />
                <div className="absolute top-[28%] left-[11%] h-40 w-64 rotate-[-18deg] bg-white/34 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-white/80 via-white/36 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-white/62 via-white/18 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.46),rgba(255,255,255,0.12)_42%,rgba(226,238,255,0.16)_100%)]" />
            </div>

            <div className="relative z-10 flex w-full max-w-[464px] flex-col items-center overflow-hidden rounded-[28px] border border-white/75 bg-white/96 px-7 py-7 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.45),0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-slate-200/80 backdrop-blur-md sm:px-9 sm:py-8">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.11] select-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    }}
                />
                <Link
                    href={home()}
                    aria-label="Kembali ke beranda"
                    title="Kembali ke beranda"
                    className="absolute top-5 right-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-3 focus-visible:ring-blue-500/25 focus-visible:outline-none active:scale-[0.98]"
                >
                    <Home className="h-4.5 w-4.5" />
                </Link>

                <Link
                    href={home()}
                    aria-label="DEKA"
                    className="mt-6 mb-3 flex h-16 items-center justify-center overflow-visible"
                >
                    <DekaLogo className="h-20 w-auto scale-[1.55] object-contain" />
                </Link>

                <div className="mb-6 w-full text-center">
                    <h1 className="mb-2 text-[28px] leading-tight font-extrabold tracking-normal text-slate-950 sm:text-[30px]">
                        {title}
                    </h1>
                    {description && (
                        <p className="mx-auto max-w-[320px] text-sm leading-6 text-slate-500">
                            {description}
                        </p>
                    )}
                </div>

                <div className="w-full">{children}</div>
            </div>
        </div>
    );
}
