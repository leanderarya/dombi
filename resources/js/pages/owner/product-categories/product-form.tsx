import ImageUploadField from '@/components/owner/image-upload-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
    data: {
        name: string;
        flavor: string;
        size: string;
        sku: string;
        center_price: string;
        selling_price: string;
        description: string;
        is_active: boolean;
    };
    onChange: (key: keyof Props['data'], value: string | boolean) => void;
    imageFile: File | null;
    imageExisting: string | null;
    onImageChange: (f: File | null) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    processing: boolean;
    editing?: boolean;
}

export default function ProductForm({
    data,
    onChange,
    imageFile,
    imageExisting,
    onImageChange,
    onSubmit,
    onCancel,
    processing,
    editing,
}: Props) {
    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <Input label="Nama Produk" value={data.name} onChange={(e) => onChange('name', e.target.value)} required placeholder="Original 200ml" />
                <Input label="SKU (auto jika kosong)" value={data.sku} onChange={(e) => onChange('sku', e.target.value)} placeholder="AUTO" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Input label="Rasa" value={data.flavor} onChange={(e) => onChange('flavor', e.target.value)} placeholder="Coklat" />
                <Input label="Ukuran" value={data.size} onChange={(e) => onChange('size', e.target.value)} placeholder="200ml" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Input label="HPP (Rp)" type="number" value={data.center_price} onChange={(e) => onChange('center_price', e.target.value)} required min={0} />
                <Input label="Harga Jual (Rp)" type="number" value={data.selling_price} onChange={(e) => onChange('selling_price', e.target.value)} required min={0} />
            </div>
            <Textarea label="Deskripsi" value={data.description} onChange={(e) => onChange('description', e.target.value)} rows={2} />
            <ImageUploadField value={imageFile ? imageFile : imageExisting} onChange={(f) => onImageChange(f)} label="Foto Produk" />
            <label className="flex items-center gap-2">
                <input type="checkbox" checked={data.is_active} onChange={(e) => onChange('is_active', e.target.checked)} className="rounded" />
                <span className="text-sm">Aktif</span>
            </label>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
                <Button type="submit" disabled={processing}>{processing ? 'Menyimpan...' : editing ? 'Update' : 'Simpan'}</Button>
            </div>
        </form>
    );
}
