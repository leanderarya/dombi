import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Filter, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface FilterOption {
    value: string;
    label: string;
}

interface OwnerFilterCardProps {
    collapsible?: boolean;
    defaultExpanded?: boolean;

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

export default function OwnerFilterCard({
    collapsible = false,
    defaultExpanded = true,
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
    const [expanded, setExpanded] = useState(defaultExpanded);

    if (collapsible && !expanded) {
        return (
            <div className="owner-filter-card mb-4">
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-text"
                >
                    <Filter className="h-4 w-4" />
                    Filter
                    <ChevronDown className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="owner-filter-card mb-4 rounded-xl bg-surface p-3 shadow-card">
            {collapsible && (
                <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="mb-2 flex items-center gap-2 text-sm text-text-muted hover:text-text"
                >
                    <Filter className="h-4 w-4" />
                    Filter
                    <ChevronUp className="h-4 w-4" />
                </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
                {searchPlaceholder && (
                    <Input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchValue ?? ''}
                        onChange={(e) => onSearch?.(e.target.value)}
                        className="w-[200px]"
                        icon={Search}
                    />
                )}

                {outletOptions && (
                    <Select
                        value={outletValue ?? ''}
                        onChange={(e) => onOutletChange?.(e.target.value)}
                        options={[
                            { value: '', label: 'Semua Outlet' },
                            ...outletOptions,
                        ]}
                        className="w-[150px]"
                        aria-label="Filter outlet"
                    />
                )}

                {reasonOptions && (
                    <Select
                        value={reasonValue ?? ''}
                        onChange={(e) => onReasonChange?.(e.target.value)}
                        options={[
                            { value: '', label: 'Semua Alasan' },
                            ...reasonOptions,
                        ]}
                        className="w-[150px]"
                        aria-label="Filter alasan"
                    />
                )}

                {courierOptions && (
                    <Select
                        value={courierValue ?? ''}
                        onChange={(e) => onCourierChange?.(e.target.value)}
                        options={[
                            { value: '', label: 'Semua Kurir' },
                            ...courierOptions,
                        ]}
                        className="w-[150px]"
                        aria-label="Filter kurir"
                    />
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
                    <Select
                        value={marginValue ?? ''}
                        onChange={(e) => onMarginChange?.(e.target.value)}
                        options={[
                            { value: '', label: marginLabel },
                            ...marginOptions,
                        ]}
                        className="w-[160px]"
                        aria-label="Filter margin"
                    />
                )}

                {children}

                {tambahHref && (
                    <Link
                        href={tambahHref}
                        className={buttonVariants({
                            variant: 'primary',
                            size: 'lg',
                        })}
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {tambahLabel}
                    </Link>
                )}
                {tambahOnClick && (
                    <Button
                        type="button"
                        size="lg"
                        variant={tambahActive ? 'outline' : 'default'}
                        onClick={tambahOnClick}
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {tambahActive ? 'Batal' : tambahLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}
