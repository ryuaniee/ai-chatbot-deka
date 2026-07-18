import { router } from '@inertiajs/react';
import { LogOut, Settings } from 'lucide-react';
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import type { User } from '@/types';

type Props = {
    user: User;
    onSettingsClick?: () => void;
    onLogoutClick?: () => void;
};

export function UserMenuContent({ user, onSettingsClick, onLogoutClick }: Props) {
    const cleanup = useMobileNavigation();

    const handleSettings = () => {
        cleanup();

        if (onSettingsClick) {
            onSettingsClick();

            return;
        }
    };

    const handleLogout = (e: Event) => {
        cleanup();
        if (onLogoutClick) {
            e.preventDefault();
            onLogoutClick();
        } else {
            router.flushAll();
            router.post(logout.url());
        }
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem onSelect={handleSettings}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout} data-test="logout-button">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
            </DropdownMenuItem>
        </>
    );
}
