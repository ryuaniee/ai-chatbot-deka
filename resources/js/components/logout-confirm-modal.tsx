import { router } from '@inertiajs/react';
import { logout } from '@/routes';
import type { User } from '@/types';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    user: User;
};

export default function LogoutConfirmModal({ isOpen, onClose, user }: Props) {
    if (!isOpen) {
        return null;
    }

    const handleLogout = () => {
        onClose();
        router.flushAll();
        router.post(logout.url());
    };

    return (
        <div className="fixed inset-0 z-[110] flex animate-in items-center justify-center bg-black/40 p-4 backdrop-blur-[1.5px] duration-200 fade-in">
            {/* Modal Card */}
            <div className="relative w-full max-w-[400px] animate-in rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl duration-200 zoom-in-95 md:p-8">
                <h3 className="mb-6 text-center text-[22px] leading-snug font-bold tracking-tight text-slate-900">
                    Yakin ingin keluar?
                </h3>

                {/* User card info */}
                <div className="mb-6 flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm">
                        {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base leading-tight font-bold text-slate-900">
                            {user.name}
                        </p>
                        <p className="truncate text-sm leading-snug text-slate-500">
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
                        Keluar
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full cursor-pointer rounded-full border border-slate-200 bg-white py-3.5 text-base font-semibold text-slate-700 transition duration-200 hover:bg-slate-50 hover:text-slate-950 active:scale-98"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
    );
}
