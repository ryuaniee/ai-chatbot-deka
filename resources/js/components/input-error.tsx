import { CircleAlert } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <p
            {...props}
            className={cn(
                'flex items-start gap-1.5 text-xs leading-5 font-medium text-rose-600',
                className,
            )}
        >
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {message}
        </p>
    ) : null;
}
