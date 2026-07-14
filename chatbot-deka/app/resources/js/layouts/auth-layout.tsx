import { Link } from '@inertiajs/react';
import DekaLogo from '@/components/deka-logo';
import { home } from '@/routes';
import { Coffee, Clock, MessageSquare, Sparkles, ArrowLeft } from 'lucide-react';

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
        <div className="relative flex min-h-screen w-full items-center justify-center p-4 md:p-6 overflow-x-hidden bg-[#f4f7fa]">
            {/* 3D-like Fluid Animated Mesh Background */}
            <div className="absolute inset-0 overflow-hidden select-none pointer-events-none">
                {/* Glowing mesh blobs */}
                <div className="absolute -left-20 top-20 w-[450px] h-[450px] rounded-full bg-blue-400/35 blur-[120px] animate-blob-1" />
                <div className="absolute -right-20 bottom-20 w-[500px] h-[500px] rounded-full bg-indigo-400/30 blur-[130px] animate-blob-2" />
                <div className="absolute left-1/3 bottom-1/3 w-[350px] h-[350px] rounded-full bg-violet-400/30 blur-[100px] animate-blob-3" />
                
                {/* Thin tech grid lines overlay to make it look 3D techy */}
                <div 
                    className="absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, #000 1.5px, transparent 0)`,
                        backgroundSize: '32px 32px'
                    }}
                />
            </div>

            {/* Centered Auth Card */}
            <div className="relative z-10 w-full max-w-[500px] rounded-[2rem] bg-white/95 p-8 md:p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-zinc-200/60 backdrop-blur-md flex flex-col items-center overflow-hidden">
                {/* Matte Paper / Frosted Glass Noise Texture Overlay */}
                <div 
                    className="absolute inset-0 opacity-[0.15] pointer-events-none select-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                    }}
                />
                {/* Top-Right Circular Back Button */}
                <Link
                    href={home()}
                    className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-800 active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>

                {/* Logo */}
                <Link href={home()} className="mb-4 block">
                    <DekaLogo className="h-32 w-auto object-contain" />
                </Link>

                {/* Heading and Description */}
                <div className="text-center mb-6 w-full">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 mb-2 font-serif">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm text-zinc-500 max-w-[300px] mx-auto leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                {/* Children: Form Fields */}
                <div className="w-full">
                    {children}
                </div>
            </div>
        </div>
    );
}
