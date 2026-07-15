import { Form, usePage } from '@inertiajs/react';
import { Palette, Shield, User, X } from 'lucide-react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import AppearanceToggleTab from '@/components/appearance-tabs';
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
    const [activeTab, setActiveTab] = useState<
        'profile' | 'security' | 'appearance'
    >('profile');

    if (!isOpen) {
        return null;
    }

    const tabs = [
        { id: 'profile' as const, label: 'General', icon: User },
        { id: 'security' as const, label: 'Security', icon: Shield },
        { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex animate-in items-center justify-center bg-black/35 p-4 backdrop-blur-[1.5px] duration-200 fade-in">
            {/* Modal Box */}
            <div className="relative flex h-[520px] w-full max-w-[720px] animate-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200 zoom-in-95">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close settings"
                >
                    <X className="h-4.5 w-4.5" />
                </button>

                {/* Left Sidebar */}
                <aside className="flex w-48 flex-col border-r border-slate-200 bg-slate-50/80 p-3 pt-12">
                    <nav className="flex-1 space-y-1.5">
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
                <main className="flex-1 overflow-y-auto px-8 pt-12 pb-8">
                    <div className="space-y-6">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        General Settings
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Manage your name and email address
                                    </p>
                                </div>
                                <Form
                                    {...ProfileController.update.form()}
                                    options={{
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
                                                    Name
                                                </Label>
                                                <Input
                                                    id="settings-name"
                                                    className="w-full"
                                                    defaultValue={
                                                        auth.user.name
                                                    }
                                                    name="name"
                                                    required
                                                    autoComplete="name"
                                                    placeholder="Full name"
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
                                                    Email Address
                                                </Label>
                                                <Input
                                                    id="settings-email"
                                                    type="email"
                                                    className="w-full"
                                                    defaultValue={
                                                        auth.user.email
                                                    }
                                                    name="email"
                                                    required
                                                    autoComplete="username"
                                                    placeholder="Email address"
                                                />
                                                <InputError
                                                    className="mt-1"
                                                    message={errors.email}
                                                />
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    disabled={processing}
                                                    className="cursor-pointer bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700"
                                                >
                                                    Save changes
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
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Security Settings
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Ensure your account is using a long,
                                        random password to stay secure
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
                                                    Current Password
                                                </Label>
                                                <PasswordInput
                                                    id="settings-current_password"
                                                    name="current_password"
                                                    className="w-full"
                                                    autoComplete="current-password"
                                                    placeholder="Current password"
                                                />
                                                <InputError
                                                    message={
                                                        errors.current_password
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-password">
                                                    New Password
                                                </Label>
                                                <PasswordInput
                                                    id="settings-password"
                                                    name="password"
                                                    className="w-full"
                                                    autoComplete="new-password"
                                                    placeholder="New password"
                                                />
                                                <InputError
                                                    message={errors.password}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-password_confirmation">
                                                    Confirm Password
                                                </Label>
                                                <PasswordInput
                                                    id="settings-password_confirmation"
                                                    name="password_confirmation"
                                                    className="w-full"
                                                    autoComplete="new-password"
                                                    placeholder="Confirm password"
                                                />
                                                <InputError
                                                    message={
                                                        errors.password_confirmation
                                                    }
                                                />
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    disabled={processing}
                                                    className="cursor-pointer bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700"
                                                >
                                                    Save changes
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

                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Appearance Settings
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Update the theme and layout for your
                                        application
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-sm font-semibold text-slate-700">
                                            Theme Mode
                                        </Label>
                                        <AppearanceToggleTab className="mt-1" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
