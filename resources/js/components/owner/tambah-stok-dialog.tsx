import { useForm } from '@inertiajs/react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { displayProductName } from '@/lib/display';

type OutletOption = { id: number; name: string };
type ProductOption = {
    id: number;
    name: string;
    category_name?: string | null;
    size_unit?: string | null;
};

interface Props {
    open: boolean;
    onClose: () => void;
    outlets: OutletOption[];
    products: ProductOption[];
}

const EMPTY = {
    outlet_id: '',
    product_id: '',
    current_stock: 0,
    minimum_stock: 0,
    notes: '',
};

// DESIGN.md: stock quantities are displayed with an explicit unit (Liter/Pcs).
function unitLabel(sizeUnit?: string | null): string {
    return sizeUnit === 'ml' ||
        sizeUnit === 'l' ||
        sizeUnit === 'g' ||
        sizeUnit === 'kg'
        ? 'Liter'
        : 'Pcs';
}

export default function TambahStokDialog({
    open,
    onClose,
    outlets,
    products,
}: Props) {
    const form = useForm({ ...EMPTY });

    const stockUnit = useMemo(
        () =>
            unitLabel(
                products.find((p) => String(p.id) === form.data.product_id)
                    ?.size_unit,
            ),
        [products, form.data.product_id],
    );

    const close = () => {
        form.clearErrors();
        onClose();
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/owner/inventories', {
            onSuccess: () => {
                // No success toast here: the controller flashes one and
                // OwnerLayout's useFlashToast already shows it.
                form.reset();
                onClose();
            },
            onError: (errors) => toast.error(Object.values(errors).join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Stok</DialogTitle>
                    <DialogDescription>
                        Catat inventaris baru ke outlet.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <Select
                        label="Outlet"
                        value={form.data.outlet_id}
                        onChange={(e) =>
                            form.setData('outlet_id', e.target.value)
                        }
                        options={outlets.map((o) => ({
                            value: String(o.id),
                            label: o.name,
                        }))}
                        placeholder="Pilih Outlet"
                        error={form.errors.outlet_id}
                    />

                    <Select
                        label="Produk"
                        value={form.data.product_id}
                        onChange={(e) =>
                            form.setData('product_id', e.target.value)
                        }
                        options={products.map((p) => ({
                            value: String(p.id),
                            label: displayProductName(p),
                        }))}
                        placeholder="Pilih Produk"
                        error={form.errors.product_id}
                    />

                    <Input
                        label="Stok Saat Ini"
                        type="number"
                        min={0}
                        value={form.data.current_stock}
                        onChange={(e) =>
                            form.setData(
                                'current_stock',
                                Number(e.target.value),
                            )
                        }
                        error={form.errors.current_stock}
                        className="tabular-nums"
                    />

                    <Input
                        label={`Stok Minimum (${stockUnit})`}
                        type="number"
                        min={0}
                        value={form.data.minimum_stock}
                        onChange={(e) =>
                            form.setData(
                                'minimum_stock',
                                Number(e.target.value),
                            )
                        }
                        error={form.errors.minimum_stock}
                        className="tabular-nums"
                    />

                    <Textarea
                        label="Catatan"
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        error={form.errors.notes}
                    />

                    <DialogFooter>
                        <Button variant="outline" onClick={close}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            size="lg"
                            loading={form.processing}
                        >
                            Tambah Stok
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
