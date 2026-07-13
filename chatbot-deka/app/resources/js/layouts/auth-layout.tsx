import { Link } from '@inertiajs/react';
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
        <div className="flex h-screen w-full flex-col lg:flex-row bg-white text-black overflow-hidden">
            {/* Left Panel: Blue Gradient & Glassmorphism Card */}
            <div className="relative hidden w-full lg:flex lg:w-[42%] flex-col items-center justify-center bg-gradient-to-b from-[#7CB8F7] via-[#2A75E5] to-[#0A6BE4] p-12 overflow-hidden select-none">
                {/* Top Center Circle peeking down */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[#E5E7EB] rounded-full" />
                
                {/* Bottom Left Circle peeking up */}
                <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#E5E7EB] rounded-full" />

                {/* Floating Frosted Glass Card */}
                <div className="relative z-10 w-full max-w-[360px] aspect-square rounded-[2.5rem] bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden">
                    {/* Inner glowing white dot */}
                    <div className="absolute left-[15%] w-24 h-24 rounded-full bg-white opacity-40 blur-2xl" />
                </div>
            </div>

            {/* Right Panel: White Background & Auth Form */}
            <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6 bg-white overflow-hidden">
                <div className="w-full max-w-[440px] flex flex-col items-center">
                    {/* Logo */}
                    <Link href={home()} className="mb-2 block">
                        <DekaLogo className="h-50 w-auto object-contain" />
                    </Link>

                    {/* Heading and Description */}
                    <div className="text-center mb-4 w-full">
                        <h1 className="text-3xl font-extrabold tracking-tight text-black mb-3">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-sm text-gray-500 max-w-[320px] mx-auto leading-relaxed">
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
        </div>
    );
}
