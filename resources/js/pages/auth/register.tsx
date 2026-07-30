import { Head, useHttp } from '@inertiajs/react';
import { CheckCircle2, Circle, Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { login } from '@/routes';
import { register as apiRegister } from '@/routes/api/auth';

type Props = {
    passwordRules: string;
};

const getMinPasswordLength = (passwordRules: string) =>
    Number(passwordRules.match(/minlength:\s*(\d+)/i)?.[1] ?? 8);

const getPasswordStrength = (password: string, minLength: number) => {
    const checks = [
        password.length >= minLength,
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password),
        password.length >= Math.max(12, minLength + 4),
    ];
    const score = checks.filter(Boolean).length;
    const percent = Math.round((score / checks.length) * 100);

    if (score <= 2) {
        return {
            label: 'Lemah',
            percent,
            barClass: 'bg-rose-500',
            textClass: 'text-rose-600',
        };
    }

    if (score <= 4) {
        return {
            label: 'Cukup',
            percent,
            barClass: 'bg-amber-500',
            textClass: 'text-amber-600',
        };
    }

    if (score === 5) {
        return {
            label: 'Kuat',
            percent,
            barClass: 'bg-emerald-500',
            textClass: 'text-emerald-600',
        };
    }

    return {
        label: 'Sangat kuat',
        percent,
        barClass: 'bg-blue-600',
        textClass: 'text-blue-700',
    };
};

const getPasswordRequirements = (password: string, minLength: number) => [
    {
        label: `${minLength}+ karakter`,
        met: password.length >= minLength,
    },
    {
        label: 'Besar dan kecil',
        met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    {
        label: 'Angka',
        met: /\d/.test(password),
    },
    {
        label: 'Simbol',
        met: /[^A-Za-z0-9]/.test(password),
    },
];

const GoogleIcon = () => (
    <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
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

export default function Register({ passwordRules }: Props) {
    const http = useHttp({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });
    const [validationErrors, setValidationErrors] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });
    const [passwordFocused, setPasswordFocused] = useState(false);
    const minPasswordLength = getMinPasswordLength(passwordRules);
    const passwordStrength = getPasswordStrength(
        http.data.password,
        minPasswordLength,
    );
    const passwordRequirements = getPasswordRequirements(
        http.data.password,
        minPasswordLength,
    );
    const showPasswordHelp = passwordFocused || http.data.password.length > 0;
    const confirmationStatus =
        http.data.password_confirmation.length === 0
            ? null
            : http.data.password === http.data.password_confirmation
              ? 'match'
              : 'mismatch';

    const validate = () => {
        const errors = {
            name: '',
            email: '',
            password: '',
            password_confirmation: '',
        };

        if (!http.data.name.trim()) {
            errors.name = 'Nama lengkap wajib diisi.';
        }

        if (!http.data.email.trim()) {
            errors.email = 'Email wajib diisi.';
        }

        if (!http.data.password) {
            errors.password = 'Kata sandi wajib diisi.';
        }

        if (!http.data.password_confirmation) {
            errors.password_confirmation = 'Konfirmasi kata sandi wajib diisi.';
        } else if (http.data.password !== http.data.password_confirmation) {
            errors.password_confirmation = 'Konfirmasi kata sandi belum cocok.';
        }

        setValidationErrors(errors);

        return (
            !errors.name &&
            !errors.email &&
            !errors.password &&
            !errors.password_confirmation
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        http.post(apiRegister.url())
            .then((res: any) => {
                if (res.redirect_to) {
                    window.location.assign(res.redirect_to);
                }
            })
            .catch(() => {
                http.reset('password', 'password_confirmation');
            });
    };

    return (
        <>
            <Head title="Daftar" />
            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3"
                noValidate
            >
                <div className="grid gap-2.5">
                    {/* Name */}
                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="name"
                            className="text-[11px] font-bold tracking-[0.11em] text-slate-600 uppercase"
                        >
                            Nama Lengkap
                        </Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
                                <User className="h-4 w-4" />
                            </span>
                            <Input
                                id="name"
                                type="text"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="name"
                                name="name"
                                placeholder="Nama lengkap Anda"
                                value={http.data.name}
                                onChange={(e) => {
                                    http.setData('name', e.target.value);
                                    setValidationErrors((errors) => ({
                                        ...errors,
                                        name: '',
                                    }));
                                }}
                                className="h-11 rounded-xl border-slate-200 bg-white pl-11 text-slate-950 shadow-sm shadow-slate-200/40 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:shadow-md focus-visible:border-[#2f80ed] focus-visible:ring-[#2f80ed]/25"
                            />
                        </div>
                        <InputError
                            message={validationErrors.name || http.errors.name}
                        />
                    </div>

                    {/* Email Address */}
                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="email"
                            className="text-[11px] font-bold tracking-[0.11em] text-slate-600 uppercase"
                        >
                            Alamat Email
                        </Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
                                <Mail className="h-4 w-4" />
                            </span>
                            <Input
                                id="email"
                                type="email"
                                required
                                tabIndex={2}
                                autoComplete="email"
                                name="email"
                                placeholder="nama@email.com"
                                value={http.data.email}
                                onChange={(e) => {
                                    http.setData('email', e.target.value);
                                    setValidationErrors((errors) => ({
                                        ...errors,
                                        email: '',
                                    }));
                                }}
                                className="h-11 rounded-xl border-slate-200 bg-white pl-11 text-slate-950 shadow-sm shadow-slate-200/40 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:shadow-md focus-visible:border-[#2f80ed] focus-visible:ring-[#2f80ed]/25"
                            />
                        </div>
                        <InputError
                            message={
                                validationErrors.email || http.errors.email
                            }
                        />
                    </div>

                    {/* Password */}
                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="password"
                            className="text-[11px] font-bold tracking-[0.11em] text-slate-600 uppercase"
                        >
                            Kata Sandi
                        </Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-zinc-400">
                                <Lock className="h-4 w-4" />
                            </span>
                            <PasswordInput
                                id="password"
                                required
                                tabIndex={3}
                                autoComplete="new-password"
                                name="password"
                                placeholder="Masukkan kata sandi"
                                passwordrules={passwordRules}
                                value={http.data.password}
                                onChange={(e) => {
                                    http.setData('password', e.target.value);
                                    setValidationErrors((errors) => ({
                                        ...errors,
                                        password: '',
                                    }));
                                }}
                                onFocus={() => setPasswordFocused(true)}
                                onBlur={() => setPasswordFocused(false)}
                                className="h-11 rounded-xl border-slate-200 bg-white pl-11 text-slate-950 shadow-sm shadow-slate-200/40 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:shadow-md focus-visible:border-[#2f80ed] focus-visible:ring-[#2f80ed]/25"
                            />
                        </div>
                        <InputError
                            message={
                                validationErrors.password ||
                                http.errors.password
                            }
                        />
                        <div
                            className="space-y-2"
                            aria-live="polite"
                            aria-label={`Kekuatan kata sandi ${passwordStrength.label}`}
                        >
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${passwordStrength.barClass}`}
                                    style={{
                                        width: `${passwordStrength.percent}%`,
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] leading-4">
                                <span className="text-slate-500">
                                    Minimal {minPasswordLength} karakter
                                </span>
                                <span
                                    className={`font-semibold ${passwordStrength.textClass}`}
                                >
                                    {passwordStrength.label}
                                </span>
                            </div>
                            {showPasswordHelp && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {passwordRequirements.map((requirement) => (
                                        <div
                                            key={requirement.label}
                                            className={cn(
                                                'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] leading-none font-semibold transition-colors',
                                                requirement.met
                                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                    : 'border-slate-200 bg-white/70 text-slate-500',
                                            )}
                                        >
                                            {requirement.met ? (
                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                            ) : (
                                                <Circle className="h-3 w-3 shrink-0" />
                                            )}
                                            <span>{requirement.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="password_confirmation"
                            className="text-[11px] font-bold tracking-[0.11em] text-slate-600 uppercase"
                        >
                            Ulangi Kata Sandi
                        </Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-zinc-400">
                                <Lock className="h-4 w-4" />
                            </span>
                            <PasswordInput
                                id="password_confirmation"
                                required
                                tabIndex={4}
                                autoComplete="new-password"
                                name="password_confirmation"
                                placeholder="Ulangi kata sandi"
                                passwordrules={passwordRules}
                                value={http.data.password_confirmation}
                                onChange={(e) => {
                                    http.setData(
                                        'password_confirmation',
                                        e.target.value,
                                    );
                                    setValidationErrors((errors) => ({
                                        ...errors,
                                        password_confirmation: '',
                                    }));
                                }}
                                className={cn(
                                    'h-11 rounded-xl border-slate-200 bg-white pl-11 text-slate-950 shadow-sm shadow-slate-200/40 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:shadow-md focus-visible:border-[#2f80ed] focus-visible:ring-[#2f80ed]/25',
                                    confirmationStatus === 'match' &&
                                        'border-blue-300 focus-visible:border-blue-500 focus-visible:ring-blue-500/25',
                                    confirmationStatus === 'mismatch' &&
                                        'border-rose-300 focus-visible:border-rose-500 focus-visible:ring-rose-500/20',
                                )}
                            />
                        </div>
                        <InputError
                            message={
                                validationErrors.password_confirmation ||
                                http.errors.password_confirmation
                            }
                        />
                        {confirmationStatus && (
                            <p
                                className={cn(
                                    'flex items-center gap-1.5 text-xs leading-5 font-medium',
                                    confirmationStatus === 'match'
                                        ? 'text-blue-700'
                                        : 'text-rose-600',
                                )}
                                aria-live="polite"
                            >
                                {confirmationStatus === 'match' ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                    <Circle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                {confirmationStatus === 'match'
                                    ? 'Kata sandi cocok.'
                                    : 'Kata sandi belum sama.'}
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="mt-1 flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border-none bg-[#2563eb] text-sm font-bold tracking-normal text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-[#1d4ed8] hover:shadow-blue-600/25 active:scale-[0.99] disabled:shadow-none"
                        tabIndex={5}
                        data-test="register-user-button"
                        disabled={http.processing}
                    >
                        {http.processing && (
                            <Spinner className="mr-2 h-4 w-4 animate-spin text-white" />
                        )}
                        Daftar
                    </Button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center py-1.5">
                    <div className="flex-grow border-t border-zinc-200"></div>
                    <span className="mx-4 flex-shrink text-xs font-semibold text-slate-400">
                        atau lanjut dengan
                    </span>
                    <div className="flex-grow border-t border-zinc-200"></div>
                </div>

                {/* Google Sign In */}
                <button
                    type="button"
                    onClick={() => window.location.assign('/auth/google')}
                    className="flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm shadow-slate-200/60 transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:text-slate-950 hover:shadow-md active:scale-[0.99]"
                >
                    <GoogleIcon />
                    <span className="text-sm font-bold">
                        Lanjutkan dengan Google
                    </span>
                </button>

                {/* Footer - redirects to login */}
                <div className="mt-1 text-center text-sm font-medium text-slate-600">
                    Sudah punya akun?{' '}
                    <TextLink
                        href={login()}
                        className="font-semibold text-[#2f80ed] hover:underline"
                        tabIndex={6}
                    >
                        Masuk
                    </TextLink>
                </div>
            </form>
        </>
    );
}

Register.layout = {
    title: 'Daftar akun Deka',
    description: 'Simpan riwayat percakapan Anda.',
};
