import { Input } from '@/components/ui/input';

export type ProductFilterValue =
    | 'all'
    | 'active'
    | 'inactive'
    | 'out_of_stock'
    | 'low_stock'
    | 'has_image'
    | 'no_image'
    | 'trashed';

const FILTERS: { key: ProductFilterValue; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
    { key: 'out_of_stock', label: 'Out Of Stock' },
    { key: 'low_stock', label: 'Low Stock' },
    { key: 'has_image', label: 'Has Image' },
    { key: 'no_image', label: 'No Image' },
    { key: 'trashed', label: 'Terhapus' },
];

interface Props {
    search: string;
    onSearch: (value: string) => void;
    filter: string;
    onFilterChange: (value: string) => void;
    /** Count drawn on the Terhapus chip; the chip is hidden when it is 0. */
    trashedCount?: number;
}

export default function ProductSearchFilters({
    search,
    onSearch,
    filter,
    onFilterChange,
    trashedCount = 0,
}: Props) {
    const filters = FILTERS.filter(
        (f) => f.key !== 'trashed' || trashedCount > 0,
    );

    return (
        <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                    type="text"
                    placeholder="Cari Nama, Kategori, SKU, Brand, Rasa, Ukuran"
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-72"
                />
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => onFilterChange(f.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${filter === f.key ? 'bg-success-bg text-success-text ring-success-border' : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'}`}
                    >
                        {f.label}
                        {f.key === 'trashed' && (
                            <span className="ml-1 tabular-nums">
                                ({trashedCount})
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </>
    );
}
