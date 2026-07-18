import { router } from '@inertiajs/react';
import type { User } from '@/types';
import { logout } from '@/routes';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    user: User;
};

export default function LogoutConfirmModal({ isOpen, onClose, user }: Props) {
    if (!isOpen) return null;

    const handleLogout = () => {
        onClose();
        router.flushAll();
        router.post(logout.url());
    };

    return (
        <div className="fixed inset-0 z-[110] flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-[1.5px] duration-200 fade-in">
            {/* Modal Card */}
            <div className="relative w-full max-w-[400px] animate-in rounded-[28px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-2xl duration-200 zoom-in-95">
                <h3 className="text-center text-[22px] font-bold tracking-tight leading-snug text-slate-900 mb-6">
                    Are you sure you want to log out?
                </h3>

                {/* User card info */}
                <div className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 mb-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm">
                        {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="truncate text-base font-bold text-slate-900 leading-tight">
                            {user.name}
                        </p>
                        <p className="truncate text-sm text-slate-500 leading-snug">
                            {user.email}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5">
                    <button
                        onClick={handleLogout}
                        className="w-full cursor-pointer rounded-full bg-blue-600 py-3.5 text-base font-bold text-white shadow-md shadow-blue-500/10 transition duration-200 hover:bg-blue-500 hover:shadow-lg active:scale-98"
                    >
                        Log out
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full cursor-pointer rounded-full border border-slate-200 bg-white py-3.5 text-base font-semibold text-slate-700 transition duration-200 hover:bg-slate-50 hover:text-slate-950 active:scale-98"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
