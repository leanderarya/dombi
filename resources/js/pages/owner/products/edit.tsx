import { Head, useForm } from '@inertiajs/react';
import OwnerLayout from '../../../layouts/owner-layout';
import { ProductForm } from './create';

export default function EditProduct({ product, categories }: any) {
    const form = useForm({ product_category_id: product.product_category_id ?? '', name: product.name, description: product.description ?? '', size: product.size ?? '', unit: product.unit, price: product.price, is_active: product.is_active });
    return <OwnerLayout><Head title="Edit Produk" /><h1 className="text-2xl font-semibold">Edit Produk</h1><ProductForm form={form} categories={categories} submit={(e: any) => { e.preventDefault(); form.put(`/owner/products/${product.id}`); }} /></OwnerLayout>;
}
