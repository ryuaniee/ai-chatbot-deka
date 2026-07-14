import { useState } from 'react';
import { Form, usePage } from '@inertiajs/react';
import { X, User, Shield, Palette } from 'lucide-react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import AppearanceToggleTab from '@/components/appearance-tabs';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/password-input';
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
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance'>('profile');

    if (!isOpen) return null;

    const tabs = [
        { id: 'profile' as const, label: 'General', icon: User },
        { id: 'security' as const, label: 'Security', icon: Shield },
        { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Modal Box */}
            <div className="relative flex w-full max-w-3xl h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer z-10"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Left Sidebar */}
                <aside className="w-56 bg-slate-50 border-r border-slate-200 p-4 flex flex-col pt-12">
                    <nav className="flex-1 space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition cursor-pointer font-medium ${
                                        isActive
                                            ? 'bg-slate-200/60 text-slate-900 font-semibold'
                                            : 'text-slate-650 hover:bg-slate-200/30 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Right Content Pane */}
                <main className="flex-1 p-8 overflow-y-auto flex flex-col justify-between pt-12">
                    <div className="space-y-6">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">General Settings</h3>
                                    <p className="text-xs text-slate-500 mt-1">Manage your name and email address</p>
                                </div>
                                <Form
                                    {...ProfileController.update.form()}
                                    options={{
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            // Handle success logic if needed
                                        }
                                    }}
                                    className="space-y-4"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-name" className="text-sm font-semibold text-slate-700">Name</Label>
                                                <Input
                                                    id="settings-name"
                                                    className="w-full"
                                                    defaultValue={auth.user.name}
                                                    name="name"
                                                    required
                                                    autoComplete="name"
                                                    placeholder="Full name"
                                                />
                                                <InputError className="mt-1" message={errors.name} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                                                <Input
                                                    id="settings-email"
                                                    type="email"
                                                    className="w-full"
                                                    defaultValue={auth.user.email}
                                                    name="email"
                                                    required
                                                    autoComplete="username"
                                                    placeholder="Email address"
                                                />
                                                <InputError className="mt-1" message={errors.email} />
                                            </div>

                                            <div className="pt-2">
                                                <Button
                                                    disabled={processing}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
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

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Security Settings</h3>
                                    <p className="text-xs text-slate-500 mt-1">Ensure your account is using a long, random password to stay secure</p>
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
                                                <Label htmlFor="settings-current_password">Current Password</Label>
                                                <PasswordInput
                                                    id="settings-current_password"
                                                    name="current_password"
                                                    className="w-full"
                                                    autoComplete="current-password"
                                                    placeholder="Current password"
                                                />
                                                <InputError message={errors.current_password} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-password">New Password</Label>
                                                <PasswordInput
                                                    id="settings-password"
                                                    name="password"
                                                    className="w-full"
                                                    autoComplete="new-password"
                                                    placeholder="New password"
                                                />
                                                <InputError message={errors.password} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="settings-password_confirmation">Confirm Password</Label>
                                                <PasswordInput
                                                    id="settings-password_confirmation"
                                                    name="password_confirmation"
                                                    className="w-full"
                                                    autoComplete="new-password"
                                                    placeholder="Confirm password"
                                                />
                                                <InputError message={errors.password_confirmation} />
                                            </div>

                                            <div className="pt-2">
                                                <Button
                                                    disabled={processing}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                                                >
                                                    Save changes
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </div>
                        )}

                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Appearance Settings</h3>
                                    <p className="text-xs text-slate-500 mt-1">Update the theme and layout for your application</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-sm font-semibold text-slate-700">Theme Mode</Label>
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
