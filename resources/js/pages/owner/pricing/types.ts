export interface PusatVariant {
    variant_id: number;
    name: string;
    family_name: string | null;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
    outlet_override_count: number;
}

export interface PusatKpis {
    total_variants: number;
    avg_hpp: number;
    avg_margin: number;
    negative_margin_count: number;
}

export interface OutletData {
    id: number;
    name: string;
    override_count: number;
    total_variants: number;
    all_standard: boolean;
}

export interface OutletPriceRow {
    variant_id: number;
    name: string;
    family_name: string | null;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
    has_override?: boolean;
}

export interface OtherOutlet {
    id: number;
    name: string;
}

export interface AuditLog {
    id: number;
    outlet: string;
    product: string;
    old_price: number;
    new_price: number;
    action: string;
    changed_by: string;
    created_at: string;
}

export interface PaginatedLogs {
    data: AuditLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

export type SortKey = 'name' | 'center_price' | 'selling_price' | 'margin';
export type SortDir = 'asc' | 'desc';
export type MarginFilter = 'all' | 'high' | 'low' | 'negative';
