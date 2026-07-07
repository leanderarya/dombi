import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';

interface FilterOption {
    value: string;
    label: string;
}

interface OwnerFilterCardProps {
    searchPlaceholder?: string;
    searchValue?: string;
    onSearch?: (value: string) => void;

    tambahHref?: string;
    tambahLabel?: string;

    outletOptions?: FilterOption[];
    outletValue?: string;
    onOutletChange?: (value: string) => void;

    reasonOptions?: FilterOption[];
    reasonValue?: string;
    onReasonChange?: (value: string) => void;

    courierOptions?: FilterOption[];
    courierValue?: string;
    onCourierChange?: (value: string) => void;

    dateValue?: string;
    onDateChange?: (value: string) => void;
}

const filterClass =
    'h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-text outline-none placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20';

export default function OwnerFilterCard({
    searchPlaceholder,
    searchValue,
    onSearch,
    tambahHref,
    tambahLabel = 'Tambah',
    outletOptions,
    outletValue,
    onOutletChange,
    reasonOptions,
    reasonValue,
    onReasonChange,
    courierOptions,
    courierValue,
    onCourierChange,
    dateValue,
    onDateChange,
}: OwnerFilterCardProps) {
    return (
        <div className="mb-4 rounded-lg border border-border bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
                {searchPlaceholder && (
                    <input
                        type="text"
                        value={searchValue ?? ''}
                        onChange={(e) => onSearch?.(e.target.value)}
                        placeholder={searchPlaceholder}
                        className={`${filterClass} w-[140px]`}
                    />
                )}

                {outletOptions && (
                    <select
                        value={outletValue ?? ''}
                        onChange={(e) => onOutletChange?.(e.target.value)}
                        className={`${filterClass} w-[150px]`}
                        aria-label="Filter outlet"
                    >
                        <option value="">Semua Outlet</option>
                        {outletOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}

                {reasonOptions && (
                    <select
                        value={reasonValue ?? ''}
                        onChange={(e) => onReasonChange?.(e.target.value)}
                        className={`${filterClass} w-[150px]`}
                        aria-label="Filter alasan"
                    >
                        <option value="">Semua Alasan</option>
                        {reasonOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}

                {courierOptions && (
                    <select
                        value={courierValue ?? ''}
                        onChange={(e) => onCourierChange?.(e.target.value)}
                        className={`${filterClass} w-[150px]`}
                        aria-label="Filter kurir"
                    >
                        <option value="">Semua Kurir</option>
                        {courierOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}

                {dateValue !== undefined && (
                    <input
                        type="date"
                        value={dateValue}
                        onChange={(e) => onDateChange?.(e.target.value)}
                        className={`${filterClass} w-[140px]`}
                        aria-label="Filter tanggal"
                    />
                )}

                {tambahHref && (
                    <Link
                        href={tambahHref}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {tambahLabel}
                    </Link>
                )}
            </div>
        </div>
    );
}
