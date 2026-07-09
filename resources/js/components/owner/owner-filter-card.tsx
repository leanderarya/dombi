import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
    tambahOnClick?: () => void;
    tambahActive?: boolean;

    outletOptions?: FilterOption[];
    outletValue?: string;
    onOutletChange?: (value: string) => void;

    reasonOptions?: FilterOption[];
    reasonValue?: string;
    onReasonChange?: (value: string) => void;

    courierOptions?: FilterOption[];
    courierValue?: string;
    onCourierChange?: (value: string) => void;

    marginOptions?: FilterOption[];
    marginValue?: string;
    onMarginChange?: (value: string) => void;
    marginLabel?: string;

    dateValue?: string;
    onDateChange?: (value: string) => void;

    children?: React.ReactNode;
}

const selectBase =
    'h-8 rounded-md border border-border bg-surface outline-none appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23717171%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27/%3E%3C/svg%3E")] bg-[length:10px] bg-[right_8px_center] bg-no-repeat pr-7 focus:border-primary focus:ring-1 focus:ring-primary/20';

export default function OwnerFilterCard({
    searchPlaceholder,
    searchValue,
    onSearch,
    tambahHref,
    tambahLabel = 'Tambah',
    tambahOnClick,
    tambahActive,
    outletOptions,
    outletValue,
    onOutletChange,
    reasonOptions,
    reasonValue,
    onReasonChange,
    courierOptions,
    courierValue,
    onCourierChange,
    marginOptions,
    marginValue,
    onMarginChange,
    marginLabel = 'Semua Margin',
    dateValue,
    onDateChange,
    children,
}: OwnerFilterCardProps) {
    return (
        <div className="owner-filter-card mb-4 rounded-lg border border-border bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
                {searchPlaceholder && (
                    <Input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchValue ?? ''}
                        onChange={(e) => onSearch?.(e.target.value)}
                        className="w-[140px]"
                    />
                )}

                {outletOptions && (
                    <select
                        value={outletValue ?? ''}
                        onChange={(e) => onOutletChange?.(e.target.value)}
                        className={`${selectBase} w-[150px]`}
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
                        className={`${selectBase} w-[150px]`}
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
                        className={`${selectBase} w-[150px]`}
                        aria-label="Filter kurir"
                    >
                        <option value="">Semua Kurir</option>
                        {courierOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}

                {dateValue !== undefined && (
                    <Input
                        type="date"
                        value={dateValue}
                        onChange={(e) => onDateChange?.(e.target.value)}
                        className="w-[140px]"
                        aria-label="Filter tanggal"
                    />
                )}

                {marginOptions && (
                    <select
                        value={marginValue ?? ''}
                        onChange={(e) => onMarginChange?.(e.target.value)}
                        className={`${selectBase} w-[160px]`}
                        aria-label="Filter margin"
                    >
                        <option value="">{marginLabel}</option>
                        {marginOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                )}

                {children}

                {tambahHref && (
                    <Link
                        href={tambahHref}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {tambahLabel}
                    </Link>
                )}
                {tambahOnClick && (
                    <button
                        type="button"
                        onClick={tambahOnClick}
                        className={`inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold transition-colors ${
                            tambahActive
                                ? 'border border-border bg-white text-text active:bg-surface-muted'
                                : 'bg-primary text-white hover:bg-primary-hover'
                        }`}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {tambahActive ? 'Batal' : tambahLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
