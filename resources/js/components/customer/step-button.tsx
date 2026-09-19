import { Button } from '@/components/ui/button';

interface Props {
    label: string;
    disabled: boolean;
    processing: boolean;
    onClick: () => void;
}

export default function StepButton({
    label,
    disabled,
    processing,
    onClick,
}: Props) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0))] lg:hidden">
            <div className="mx-auto max-w-lg">
                <Button
                    type="button"
                    variant="primary"
                    onClick={onClick}
                    disabled={disabled}
                    className="min-h-14 w-full rounded-thumb font-bold disabled:bg-border disabled:text-text-subtle"
                >
                    {processing ? 'Memproses...' : label}
                </Button>
            </div>
        </div>
    );
}
