import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    onApply: () => void;
    applyLabel?: string;
}

/**
 * The custom-period row the reports and analytics screens share: two dates, the
 * word between them and the action that applies the pair. Extracted because the
 * two screens had grown the same markup separately, down to the `rounded-lg`
 * that matched neither the Input primitive nor the design tokens.
 */
export default function DateRange({
    from,
    to,
    onFromChange,
    onToChange,
    onApply,
    applyLabel = 'Terapkan',
}: Props) {
    return (
        <div className="flex items-center gap-2">
            <Input
                type="date"
                aria-label="Tanggal mulai"
                className="flex-1"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
            />
            <span className="text-xs text-text-muted">sampai</span>
            <Input
                type="date"
                aria-label="Tanggal akhir"
                className="flex-1"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
            />
            <Button
                type="button"
                size="lg"
                className="shrink-0"
                onClick={onApply}
            >
                {applyLabel}
            </Button>
        </div>
    );
}
