import { useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import CustomSelect from '@/components/ui/custom-select';

interface Variant {
    id: number;
    name: string;
    center_price: number;
    selling_price: number;
    stock: number;
}

interface EditSale {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    center_price: number;
    selling_price_snapshot: number | null;
    gross_amount: number | null;
    total_amount: number;
    payment_method: string;
    notes: string | null;
}

interface Props {
    open: boolean;
    variants: Variant[];
    onClose: () => void;
    sale?: EditSale | null;
}

const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

export default function OfflineSaleDialog({
    open,
    variants = [],
    onClose,
    sale = null,
}: Props) {
    const form = useForm({
        variant_id: sale ? String(sale.product_id) : '',
        quantity: sale ? sale.quantity : 1,
        payment_method: sale ? sale.payment_method : 'cash',
        notes: sale?.notes ?? '',
    });

    const saleId = sale?.id ?? null;
    const productId = sale?.product_id ?? null;
    const initialQuantity = sale?.quantity ?? 1;
    const paymentMethod = sale?.payment_method ?? 'cash';
    const notes = sale?.notes ?? '';

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setData({
            variant_id: productId === null ? '' : String(productId),
            quantity: initialQuantity,
            payment_method: paymentMethod,
            notes,
        });
    }, [saleId, productId, initialQuantity, paymentMethod, notes, open, form]);

    void sale; // props can be reconstructed each render; depend on scalar snapshot fields above instead.

    const variantOptions = variants.map((variant) => ({
        value: String(variant.id),
        label: variant.name,
        subtitle: `Stok: ${variant.stock} · Harga jual ${formatRupiah(variant.selling_price)}`,
    }));
    const selectedVariant = variants.find(
        (variant) => String(variant.id) === form.data.variant_id,
    );
    const centerPrice =
        sale?.center_price ?? selectedVariant?.center_price ?? 0;
    const sellingPrice = sale
        ? sale.selling_price_snapshot
        : (selectedVariant?.selling_price ?? null);
    const grossAmount =
        sellingPrice === null ? null : sellingPrice * form.data.quantity;
    const centerShare = centerPrice * form.data.quantity;
    const outletMargin =
        grossAmount === null ? null : grossAmount - centerShare;
    const quantity = Number(form.data.quantity);
    const qtyValid = Number.isInteger(quantity) && quantity >= 1;
    const availableStock = selectedVariant?.stock;
    const qtyOverflow =
        qtyValid &&
        availableStock !== undefined &&
        quantity > availableStock + (sale?.quantity ?? 0);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const opts = {
            onSuccess: () => {
                form.reset();
                onClose();
            },
        };

        if (sale) {
            form.put(`/outlet/offline-sales/${sale.id}`, opts);
        } else {
            form.post('/outlet/offline-sales', opts);
        }
    };

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-md rounded-2xl bg-surface shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-sm font-bold text-text">
                        {sale ? 'Edit Penjualan' : 'Catat Penjualan'}
                    </h2>
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        size="icon"
                        aria-label="Tutup"
                        className="h-11 w-11 active:opacity-80"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-3 px-4 py-3">
                        {sale ? (
                            <div>
                                <span className="mb-1.5 block text-xs font-medium text-text-muted">
                                    Produk
                                </span>
                                <div className="min-h-11 rounded-control border border-border bg-surface-muted px-4 py-3 text-sm font-medium text-text">
                                    {sale.product_name}
                                </div>
                            </div>
                        ) : (
                            <CustomSelect
                                label="Produk"
                                options={variantOptions}
                                value={form.data.variant_id}
                                onChange={(value: string) =>
                                    form.setData('variant_id', value)
                                }
                                placeholder="Pilih produk"
                                searchable
                            />
                        )}

                        <CustomSelect
                            label="Metode Bayar"
                            options={[
                                { value: 'cash', label: 'Tunai' },
                                { value: 'transfer', label: 'Transfer' },
                                { value: 'qris', label: 'QRIS' },
                                { value: 'other', label: 'Lainnya' },
                            ]}
                            value={form.data.payment_method}
                            onChange={(value: string) =>
                                form.setData('payment_method', value)
                            }
                        />

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label
                                    htmlFor="offline-sale-quantity"
                                    className="mb-1 block text-xs font-medium text-text-muted"
                                >
                                    Jumlah
                                </label>
                                <input
                                    id="offline-sale-quantity"
                                    name="quantity"
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    placeholder="0"
                                    value={form.data.quantity.toString()}
                                    onChange={(event) => {
                                        const raw = event.target.value;
                                        form.setData(
                                            'quantity',
                                            raw === '' ? 0 : Number(raw),
                                        );
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-border bg-surface text-center text-sm font-semibold text-text focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                />
                                {qtyOverflow && (
                                    <p className="mt-1 text-xs text-danger">
                                        Maksimal{' '}
                                        {availableStock! +
                                            (sale?.quantity ?? 0)}{' '}
                                        (stok tersedia)
                                    </p>
                                )}
                            </div>
                            <div className="flex-1">
                                <label
                                    htmlFor="offline-sale-notes"
                                    className="mb-1 block text-xs font-medium text-text-muted"
                                >
                                    Catatan
                                </label>
                                <input
                                    id="offline-sale-notes"
                                    name="notes"
                                    type="text"
                                    value={form.data.notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Opsional"
                                    className="min-h-11 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-text placeholder:text-text-muted focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                />
                            </div>
                        </div>
                        {form.errors.quantity && (
                            <p className="text-xs text-danger">
                                {form.errors.quantity}
                            </p>
                        )}
                    </div>

                    <div className="rounded-b-2xl border-t border-border bg-surface-muted/50 px-4 py-3">
                        {grossAmount !== null && (
                            <div className="mb-2 space-y-1 text-xs text-text-muted">
                                <div className="flex items-center justify-between">
                                    <span>Harga jual × jumlah</span>
                                    <span className="font-semibold text-text">
                                        {formatRupiah(grossAmount)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Setoran ke Owner</span>
                                    <span className="font-semibold text-text">
                                        {formatRupiah(centerShare)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Margin Outlet</span>
                                    <span className="font-semibold text-text">
                                        {formatRupiah(outletMargin!)}
                                    </span>
                                </div>
                            </div>
                        )}
                        {grossAmount === null && sale && (
                            <p className="mb-2 text-xs text-text-muted">
                                Harga jual historis tidak tersedia; gross dan
                                margin tidak dapat dihitung.
                            </p>
                        )}
                        <Button
                            type="submit"
                            disabled={
                                form.processing ||
                                (sale &&
                                    sale.selling_price_snapshot === null) ||
                                (!sale && !form.data.variant_id) ||
                                !qtyValid ||
                                qtyOverflow
                            }
                            size="lg"
                            className="w-full"
                        >
                            {form.processing
                                ? 'Menyimpan...'
                                : sale
                                  ? 'Update'
                                  : 'Simpan'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
