import { Form, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, Mail, Shield, User, X } from 'lucide-react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Auth } from '@/types';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

type PageProps = {
    auth: Auth;
};

export default function SettingsModal({ isOpen, onClose }: Props) {
    const { auth } = usePage<PageProps>().props;

    if (!isOpen) {
        return null;
    }

    return <SettingsModalContent auth={auth} onClose={onClose} />;
}

function SettingsModalContent({
    auth,
    onClose,
}: {
    auth: Auth;
    onClose: () => void;
}) {
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>(
        'profile',
    );
    const [mobileView, setMobileView] = useState<
        'menu' | 'profile' | 'security'
    >('menu');

    const tabs = [
        {
            id: 'profile' as const,
            label: 'Profil',
            description: 'Nama dan alamat email',
            icon: User,
        },
        {
            id: 'security' as const,
            label: 'Keamanan',
            description: 'Kata sandi dan akses akun',
            icon: Shield,
        },
    ];
    const userInitials = auth.user.name.substring(0, 2).toUpperCase();
    const fieldClass =
        'h-11 rounded-xl border-slate-200 bg-white text-slate-950 shadow-sm shadow-slate-200/40 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:shadow-md focus-visible:border-[#2f80ed] focus-visible:ring-[#2f80ed]/25';

    return (
        <div className="fixed inset-0 z-[100] flex animate-in items-stretch justify-center bg-[#f7faff] p-0 duration-200 fade-in md:items-center md:bg-black/35 md:p-4 md:backdrop-blur-[1.5px]">
            {/* Modal Box */}
            <div className="relative flex h-dvh min-h-0 w-full animate-in flex-col overflow-hidden bg-[#f7faff] duration-200 md:h-[min(620px,calc(100dvh-2rem))] md:max-w-[760px] md:flex-row md:rounded-2xl md:border md:border-slate-200 md:bg-white md:shadow-2xl md:zoom-in-95">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:flex"
                    aria-label="Tutup pengaturan"
                >
                    <X className="h-4.5 w-4.5" />
                </button>

                <button
                    onClick={() => {
                        if (mobileView === 'menu') {
                            onClose();
                        } else {
                            setMobileView('menu');
                        }
                    }}
                    className="absolute top-5 left-5 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 md:hidden"
                    aria-label={
                        mobileView === 'menu'
                            ? 'Tutup pengaturan'
                            : 'Kembali ke menu pengaturan'
                    }
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>

                {/* Mobile Menu */}
                <div
                    className={`min-h-0 flex-1 overflow-y-auto px-6 pt-20 pb-8 md:hidden ${
                        mobileView === 'menu' ? 'block' : 'hidden'
                    }`}
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-700 ring-1 ring-blue-200">
                            {userInitials}
                        </div>
                        <h2 className="mt-3 text-xl font-extrabold text-slate-950">
                            {auth.user.name}
                        </h2>
                        <p className="mt-1 max-w-[260px] truncate text-sm text-slate-500">
                            {auth.user.email}
                        </p>
                    </div>

                    <div className="mt-8">
                        <p className="mb-2 px-1 text-xs font-semibold text-slate-500">
                            Akun
                        </p>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {tabs.map((tab, index) => {
                                const Icon = tab.icon;

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setMobileView(tab.id);
                                        }}
                                        className={`flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50 ${
                                            index > 0
                                                ? 'border-t border-slate-100'
                                                : ''
                                        }`}
                                    >
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-blue-600 ring-1 ring-slate-200">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-base font-bold text-slate-900">
                                                {tab.label}
                                            </span>
                                            <span className="mt-0.5 block text-sm text-slate-500">
                                                {tab.description}
                                            </span>
                                        </span>
                                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6">
                        <p className="mb-2 px-1 text-xs font-semibold text-slate-500">
                            Informasi
                        </p>
                        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-200">
                                <Mail className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-base font-bold text-slate-900">
                                    Email
                                </span>
                                <span className="mt-0.5 block truncate text-sm text-slate-500">
                                    {auth.user.email}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Left Sidebar */}
                <aside className="hidden shrink-0 border-b border-slate-200 bg-slate-50/80 p-3 pt-12 md:block md:w-48 md:border-r md:border-b-0">
                    <nav className="grid grid-cols-2 gap-1.5 md:block md:space-y-1.5">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                        isActive
                                            ? 'bg-white font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200'
                                            : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon
                                        className={`h-4.5 w-4.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                                    />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Right Content Pane */}
                <main
                    className={`min-h-0 flex-1 overflow-y-auto px-5 pt-20 pb-8 sm:px-8 md:block md:pt-12 md:pb-7 ${
                        mobileView === 'menu' ? 'hidden' : 'block'
                    }`}
                >
                    <div className="space-y-6">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:hidden">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-1 ring-blue-200">
                                        {userInitials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-950">
                                            {auth.user.name}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500">
                                            {auth.user.email}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Pengaturan Profil
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Kelola nama dan alamat email akun Anda.
                                    </p>
                                </div>
                                <Form
                                    {...ProfileController.update.form()}
                                    options={{
                                        preserveState: true,
                                        preserveScroll: true,
                                    }}
                                    className="space-y-4"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label
                                                    htmlFor="settings-name"
                                                    className="text-sm font-semibold text-slate-700"
                                                >
                                                    Nama
                                                </Label>
                                                <Input
                                                    id="settings-name"
                                                    className={fieldClass}
                                                    defaultValue={
                                                        auth.user.name
                                                    }
                                                    name="name"
                                                    required
                                                    autoComplete="name"
                                                    placeholder="Nama lengkap"
                                                />
                                                <InputError
                                                    className="mt-1"
                                                    message={errors.name}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label
                                                    htmlFor="settings-email"
                                                    className="text-sm font-semibold text-slate-700"
                                                >
                                                    Alamat Email
                                                </Label>
                                                <Input
                                                    id="settings-email"
                                                    type="email"
                                                    className={fieldClass}
                                                    defaultValue={
                                                        auth.user.email
                                                    }
                                                    name="email"
                                                    required
                                                    autoComplete="username"
                                                    placeholder="Alamat email"
                                                />
                                                <InputError
                                                    className="mt-1"
                                                    message={errors.email}
                                                />
                                            </div>

                                            <div className="flex justify-stretch pt-2 md:justify-end">
                                                <Button
                                                    disabled={processing}
                                                    className="w-full cursor-pointer bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700 md:w-auto"
                                                >
                                                    Simpan perubahan
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </div>
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:hidden">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-1 ring-blue-200">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-950">
                                            Keamanan akun
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500">
                                            {auth.user.email}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Pengaturan Keamanan
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Gunakan kata sandi yang kuat untuk
                                        menjaga akses akun tetap aman.
                                    </p>
                                </div>
                                <Form
                                    {...SecurityController.update.form()}
                                    options={{
                                        preserveScroll: true,
                                    }}
                                    resetOnError={[
                                        'password',
                                        'password_confirmation',
                                        'current_password',
                                    ]}
                                    resetOnSuccess
                                    className="space-y-4"
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-current_password">
                                                    Kata Sandi Saat Ini
                                                </Label>
                                                <PasswordInput
                                                    id="settings-current_password"
                                                    name="current_password"
                                                    className={fieldClass}
                                                    autoComplete="current-password"
                                                    placeholder="Kata sandi saat ini"
                                                />
                                                <InputError
                                                    message={
                                                        errors.current_password
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-password">
                                                    Kata Sandi Baru
                                                </Label>
                                                <PasswordInput
                                                    id="settings-password"
                                                    name="password"
                                                    className={fieldClass}
                                                    autoComplete="new-password"
                                                    placeholder="Kata sandi baru"
                                                />
                                                <InputError
                                                    message={errors.password}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-password_confirmation">
                                                    Konfirmasi Kata Sandi
                                                </Label>
                                                <PasswordInput
                                                    id="settings-password_confirmation"
                                                    name="password_confirmation"
                                                    className={fieldClass}
                                                    autoComplete="new-password"
                                                    placeholder="Konfirmasi kata sandi"
                                                />
                                                <InputError
                                                    message={
                                                        errors.password_confirmation
                                                    }
                                                />
                                            </div>

                                            <div className="flex justify-stretch pt-2 md:justify-end">
                                                <Button
                                                    disabled={processing}
                                                    className="w-full cursor-pointer bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700 md:w-auto"
                                                >
                                                    Simpan perubahan
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>

                                <div className="border-t border-slate-100 pt-6">
                                    <DeleteUser />
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
