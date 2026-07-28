export interface ProductCategory {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    image: string | null;
    is_active: boolean;
    products_count?: number;
    products?: Product[];
}
export interface Product {
    id: number;
    product_category_id: number;
    category_name?: string;
    name: string;
    display_name?: string;
    description: string | null;
    flavor: string | null;
    size: string | null;
    sku: string | null;
    center_price: number;
    selling_price: number;
    margin?: number;
    margin_percent?: number;
    center_stock: number;
    image: string | null;
    is_active: boolean;
    stock_status?: 'available' | 'low' | 'out_of_stock';
    order_items_count?: number;
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
