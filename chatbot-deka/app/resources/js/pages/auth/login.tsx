import { Head, useHttp } from '@inertiajs/react';
import { Mail, Lock } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { login as apiLogin } from '@/routes/api/auth';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            fill="#EA4335"
        />
    </svg>
);

export default function Login({ status, canResetPassword }: Props) {
    const http = useHttp({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        http.post(apiLogin.url())
            .then((res: any) => {
                if (res.redirect_to) {
                    window.location.assign(res.redirect_to);
                }
            })
            .catch(() => {
                http.reset('password');
            });
    };

    return (
        <>
            <Head title="Masuk" />

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-6"
            >
                <div className="grid gap-5">
                    {/* Email Address */}
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                            Alamat Email
                        </Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
                                <Mail className="h-4 w-4" />
                            </span>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="email"
                                placeholder="nama@email.com"
                                value={http.data.email}
                                onChange={(e) => http.setData('email', e.target.value)}
                                className="h-12 pl-11 border-zinc-200 rounded-xl text-black bg-white focus-visible:ring-[#2f80ed]/25 focus-visible:border-[#2f80ed] placeholder:text-zinc-400 shadow-sm transition-all focus:shadow-md"
                            />
                        </div>
                        <InputError message={http.errors.email} />
                    </div>

                    {/* Password */}
                    <div className="grid gap-2">
                        <Label htmlFor="password" className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                            Kata Sandi
                        </Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400 z-10">
                                <Lock className="h-4 w-4" />
                            </span>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                tabIndex={2}
                                autoComplete="current-password"
                                placeholder="Masukkan kata sandi"
                                value={http.data.password}
                                onChange={(e) => http.setData('password', e.target.value)}
                                className="h-12 pl-11 border-zinc-200 rounded-xl text-black bg-white focus-visible:ring-[#2f80ed]/25 focus-visible:border-[#2f80ed] placeholder:text-zinc-400 shadow-sm transition-all focus:shadow-md"
                            />
                        </div>
                        <InputError message={http.errors.password} />
                    </div>

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="remember"
                                name="remember"
                                tabIndex={3}
                                checked={http.data.remember}
                                onCheckedChange={(checked) => http.setData('remember', !!checked)}
                                className="h-5 w-5 rounded-md border-zinc-300 text-[#2f80ed] focus:ring-[#2f80ed] data-[state=checked]:bg-[#2f80ed] data-[state=checked]:border-[#2f80ed] cursor-pointer shadow-sm"
                            />
                            <Label htmlFor="remember" className="text-sm font-semibold text-zinc-700 cursor-pointer select-none">
                                Ingatkan Saya
                            </Label>
                        </div>
                        {canResetPassword && (
                            <TextLink
                                href={request()}
                                className="text-sm font-semibold text-zinc-600 hover:underline hover:text-zinc-900"
                                tabIndex={5}
                            >
                                Lupa Password?
                            </TextLink>
                        )}
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full h-12 mt-4 bg-gradient-to-r from-[#2f80ed] to-[#1a73e8] hover:from-[#1a73e8] hover:to-[#155fc4] text-white font-semibold rounded-xl transition-all border-none cursor-pointer flex items-center justify-center shadow-md hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.99] text-sm tracking-wide"
                        tabIndex={4}
                        disabled={http.processing}
                    >
                        {http.processing && <Spinner className="mr-2 h-4 w-4 animate-spin text-white" />}
                        Masuk
                    </Button>
                </div>

                {/* Divider */}
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-zinc-200"></div>
                    <span className="flex-shrink mx-4 text-zinc-400 text-xs font-semibold">
                        atau lanjut dengan
                    </span>
                    <div className="flex-grow border-t border-zinc-200"></div>
                </div>

                {/* Google Sign In */}
                <button
                    type="button"
                    onClick={() => window.location.assign('/auth/google')}
                    className="w-full h-12 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-700 font-semibold rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                >
                    <GoogleIcon />
                    <span className="text-sm font-bold">Masuk atau daftar dengan Google</span>
                </button>

                {/* Footer */}
                <div className="text-center text-sm text-zinc-600 font-medium mt-2">
                    Belum punya akun?{' '}
                    <TextLink
                        href={register()}
                        className="text-[#2f80ed] hover:underline font-semibold"
                        tabIndex={6}
                    >
                        Daftar Sekarang
                    </TextLink>
                </div>
            </form>

            {status && (
                <div className="mt-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}
        </>
    );
}

Login.layout = {
    title: 'Masuk atau daftar',
    description: 'AI Chatbot cerdas untuk membantu Anda kapan pun dan di mana pun.',
};
