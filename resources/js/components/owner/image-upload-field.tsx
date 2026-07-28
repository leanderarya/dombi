import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadFieldProps {
    value: File | null | string;
    onChange: (f: File | null) => void;
    label?: string;
}

export default function ImageUploadField({
    value,
    onChange,
    label = 'Foto Produk',
}: ImageUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;

        if (file) {
            if (file.size > 4 * 1024 * 1024) {
                alert('Max 4MB');

                return;
            }

            if (preview) {
                URL.revokeObjectURL(preview);
            }

            setPreview(URL.createObjectURL(file));
            onChange(file);
        }

        // Reset input value to allow re-selecting same file
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleRemove = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }

        setPreview(null);
        onChange(null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    // Determine if we have an existing string image to hint (not preview)
    const hasExistingString = typeof value === 'string' && !!value;

    return (
        <div className="space-y-2">
            <label className="text-[11px] font-medium text-text-subtle">
                {label}
            </label>
            <div className="flex items-center gap-3">
                {preview ? (
                    <img
                        src={preview}
                        alt="Preview"
                        className="h-16 w-16 rounded object-cover ring-1 ring-slate-200"
                    />
                ) : hasExistingString ? (
                    <img
                        src={
                            (value as string).startsWith('http')
                                ? (value as string)
                                : `/storage/${value as string}`
                        }
                        alt="Existing"
                        className="h-16 w-16 rounded object-cover ring-1 ring-slate-200"
                        onError={(ev) => {
                            (ev.target as HTMLImageElement).style.display =
                                'none';
                        }}
                    />
                ) : null}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFile}
                    className="hidden"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    className="rounded bg-surface-muted px-3 py-1.5 text-xs"
                >
                    Pilih Foto
                </Button>
                {(preview || hasExistingString) && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                        Hapus
                    </button>
                )}
            </div>
            <p className="text-[10px] text-text-subtle">
                Crop 1:1, max 800x800, WebP, max 4MB
            </p>
        </div>
    );
}
