import type { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    subtitle?: string;
    children: ReactNode;
    maxWidth?: string;
}

export default function OwnerModalShell({
    open,
    onClose,
    title,
    description,
    subtitle,
    children,
    maxWidth = 'max-w-md',
}: Props) {
    const desc = description ?? subtitle;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className={maxWidth}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {desc && <DialogDescription>{desc}</DialogDescription>}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
