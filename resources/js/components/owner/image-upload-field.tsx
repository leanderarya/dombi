import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadFieldProps {
    value: File | null | string;
    onChange: (f: File | null) => void;
    onRemove?: () => void;
    label?: string;
    info?: string;
}

export default function ImageUploadField({
    value,
    onChange,
    onRemove,
    label = 'Foto Produk',
    info,
}: ImageUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [confirmingRemove, setConfirmingRemove] = useState(false);

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
            setConfirmingRemove(false);
        }

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleLocalRemove = () => {
        if (onRemove) {
            if (!confirmingRemove) {
                setConfirmingRemove(true);
                return;
            }
            setConfirmingRemove(false);
            if (preview) {
                URL.revokeObjectURL(preview);
            }
            setPreview(null);
            onChange(null);
            onRemove();
        } else {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
            setPreview(null);
            onChange(null);
        }

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleCancelRemove = () => {
        setConfirmingRemove(false);
    };

    const hasExistingString = typeof value === 'string' && !!value;

    return (
        <div className="space-y-2">
            <label className="text-[11px] font-medium text-text-subtle">
                {label}
                {info && (
                    <span className="ml-1 text-[10px] text-text-muted">
                        — {info}
                    </span>
                )}
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
                {(preview || hasExistingString) && onRemove && (
                    <>
                        {confirmingRemove ? (
                            <>
                                <span className="text-xs text-amber-600">
                                    Yakin hapus?
                                </span>
                                <button
                                    type="button"
                                    onClick={handleLocalRemove}
                                    className="text-xs font-medium text-red-600 hover:text-red-700"
                                >
                                    Ya
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelRemove}
                                    className="text-xs text-text-muted hover:text-text"
                                >
                                    Batal
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleLocalRemove}
                                className="text-xs font-medium text-red-600 hover:text-red-700"
                            >
                                Hapus
                            </button>
                        )}
                    </>
                )}
                {(preview || hasExistingString) && !onRemove && (
                    <button
                        type="button"
                        onClick={handleLocalRemove}
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
