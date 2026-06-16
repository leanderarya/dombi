import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { ProductForm } from './create';

export default function EditProduct({ product, categories }: any) {
    const form = useForm({ product_category_id: product.product_category_id ?? '', name: product.name, description: product.description ?? '', size: product.size ?? '', unit: product.unit, price: product.price, is_active: product.is_active });

    return (
        <OwnerPageShell title="Edit Produk" backHref="/owner/products">
            <ProductForm form={form} categories={categories} submit={(e: any) => {
 e.preventDefault(); form.put(`/owner/products/${product.id}`); 
}} />
        </OwnerPageShell>
    );
}
