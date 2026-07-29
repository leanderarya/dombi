export interface ProductFlavorGroup {
    id: number;
    product_category_id: number;
    flavor: string;
    normalized_flavor: string;
    description: string | null;
    image: string | null;
    is_active: boolean;
    products_count?: number;
    products?: Product[];
}
export interface ProductCategory {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    image: string | null;
    is_active: boolean;
    products_count?: number;
    flavor_groups?: ProductFlavorGroup[];
    products?: Product[];
}
export interface Product {
    id: number;
    product_category_id: number;
    product_flavor_group_id: number | null;
    category_name?: string;
    flavor_group?: ProductFlavorGroup | null;
    name: string;
    display_name?: string;
    description: string | null;
    flavor: string | null;
    size: string | null;
    size_value?: number | null;
    size_unit?: string | null;
    normalized_size?: string | null;
    sku: string | null;
    center_price: number;
    selling_price: number;
    margin?: number;
    margin_percent?: number;
    center_stock: number;
    image: string | null;
    display_image: string | null;
    has_flavor_image: boolean;
    is_active: boolean;
    stock_status?: 'available'|'low'|'out_of_stock';
}
export interface ProductPricingRow {
    product_id: number;
    name: string;
    category_name: string;
    flavor: string | null;
    size: string | null;
    center_price: number;
    selling_price: number;
    margin: number;
    outlet_override_count?: number;
}
