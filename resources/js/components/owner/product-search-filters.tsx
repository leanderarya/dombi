import { Input } from '@/components/ui/input';

export type ProductFilterValue =
    | 'all'
    | 'active'
    | 'inactive'
    | 'out_of_stock'
    | 'low_stock'
    | 'has_image'
    | 'no_image';

const FILTERS: { key: ProductFilterValue; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
    { key: 'out_of_stock', label: 'Out Of Stock' },
    { key: 'low_stock', label: 'Low Stock' },
    { key: 'has_image', label: 'Has Image' },
    { key: 'no_image', label: 'No Image' },
];

interface Props {
    search: string;
    onSearch: (value: string) => void;
    filter: string;
    onFilterChange: (value: string) => void;
}

export default function ProductSearchFilters({
    search,
    onSearch,
    filter,
    onFilterChange,
}: Props) {
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
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => onFilterChange(f.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${filter === f.key ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
        </>
    );
}
