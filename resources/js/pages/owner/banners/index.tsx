import { router, useForm } from '@inertiajs/react';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BannerImage } from '@/components/customer/hero-banner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { HeroSlide } from '@/hooks/use-hero-slides';

interface Banner extends HeroSlide {
    id: number;
    name: string;
    sort_order: number;
    is_active: boolean;
}

export default function BannersIndex({
    banners,
    maxBanners,
}: {
    banners: Banner[];
    maxBanners: number;
}) {
    const [editor, setEditor] = useState<{ banner: Banner | null } | null>(
        null,
    );
    const [pendingDelete, setPendingDelete] = useState<Banner | null>(null);
    const [deleting, setDeleting] = useState(false);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const deleteTrigger = useRef<HTMLButtonElement | null>(null);
    const status = useRef<HTMLDivElement | null>(null);
    const restoreFocus = (button: HTMLButtonElement | null) => {
        if (button?.isConnected && !button.disabled) {
            button.focus();
        } else {
            status.current?.focus();
        }
    };
    const open = (button: HTMLButtonElement, banner: Banner | null) => {
        trigger.current = button;
        setEditor({ banner });
    };
    const atCapacity = banners.length >= maxBanners;
    const activeCount = banners.filter((banner) => banner.is_active).length;

    const confirmDelete = () => {
        if (!pendingDelete || deleting) {
            return;
        }

        setDeleting(true);
        router.delete(`/owner/banners/${pendingDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => setPendingDelete(null),
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <OwnerPageShell
            title="Banner Customer"
            subtitle="Kelola gambar yang tampil di beranda customer."
            headerRight={
                <div className="text-right">
                    <Button
                        disabled={atCapacity}
                        onClick={(event) => open(event.currentTarget, null)}
                    >
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Tambah banner
                    </Button>
                    {atCapacity && (
                        <p className="mt-2 text-xs text-text-muted">
                            Sudah {maxBanners} banner. Hapus salah satu untuk
                            menambah banner baru.
                        </p>
                    )}
                </div>
            }
        >
            <div
                ref={status}
                tabIndex={-1}
                className="mb-6 rounded-xl border border-border bg-surface-muted p-4 text-sm text-text-muted"
            >
                Upload desain utuh dengan rasio 5:2. Rekomendasi 1200 × 480 px.
                Banner aktif tampil di semua outlet, dari urutan terkecil. Jika
                tidak ada yang aktif, customer melihat banner bawaan Dombi.
                Maksimal {maxBanners} banner, termasuk yang nonaktif.
                <p className="mt-3 font-medium text-text">
                    {activeCount} dari {banners.length} banner aktif
                </p>
                <p className="mt-1">
                    {activeCount === 0
                        ? 'Customer saat ini melihat 3 banner bawaan Dombi yang bergantian setiap 5 detik. Banner bawaan otomatis diganti saat ada banner Anda yang aktif. Pilih Edit, centang Aktif, lalu Simpan banner untuk menampilkan desain Anda.'
                        : activeCount === 1
                          ? 'Satu banner tampil tanpa pergantian otomatis. Aktifkan banner lain agar carousel berganti.'
                          : 'Banner aktif bergantian setiap 5 detik. Customer bisa menjeda rotasi kapan saja. Rotasi otomatis nonaktif jika preferensi kurangi gerakan aktif.'}
                </p>
            </div>
            {banners.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
                    <ImagePlus
                        className="mx-auto mb-3 h-8 w-8 text-text-muted"
                        aria-hidden="true"
                    />
                    <h2 className="font-semibold text-text">
                        Belum ada banner
                    </h2>
                    <p className="mt-1 text-sm text-text-muted">
                        Siapkan desain, lalu pilih Tambah banner. Banner baru
                        tidak aktif sampai Anda mengaktifkannya.
                    </p>
                </div>
            ) : (
                <ul className="space-y-4" aria-label="Daftar banner">
                    {banners.map((banner) => (
                        <li
                            key={banner.id}
                            className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
                        >
                            <div className="w-full shrink-0 sm:w-56">
                                <BannerImage slide={banner} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-semibold break-words text-text">
                                        {banner.name}
                                    </h2>
                                    <span
                                        className={`rounded-md px-2 py-1 text-xs font-medium ${banner.is_active ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-text-muted'}`}
                                    >
                                        {banner.is_active
                                            ? 'Aktif'
                                            : 'Nonaktif'}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-text-muted">
                                    Urutan {banner.sort_order}
                                </p>
                                <p className="mt-1 text-sm break-all text-text-muted">
                                    {banner.target_path || 'Tanpa tujuan klik'}
                                </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <Button
                                    variant="outline"
                                    aria-label={`Edit banner ${banner.name}`}
                                    onClick={(event) =>
                                        open(event.currentTarget, banner)
                                    }
                                >
                                    <Pencil
                                        className="mr-2 h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    className="text-destructive hover:text-destructive"
                                    aria-label={`Hapus banner ${banner.name}`}
                                    onClick={(event) => {
                                        deleteTrigger.current =
                                            event.currentTarget;
                                        setPendingDelete(banner);
                                    }}
                                >
                                    <Trash2
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">Hapus</span>
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <Dialog
                open={editor !== null}
                onOpenChange={(value) => {
                    if (!value) {
                        setEditor(null);
                    }
                }}
            >
                <DialogContent
                    className="sm:max-w-2xl"
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        restoreFocus(trigger.current);
                    }}
                >
                    {editor && (
                        <BannerEditor
                            key={editor.banner?.id ?? 'new'}
                            banner={editor.banner}
                            onSaved={() =>
                                setEditor((current) =>
                                    current === editor ? null : current,
                                )
                            }
                        />
                    )}
                </DialogContent>
            </Dialog>
            <Dialog
                open={pendingDelete !== null}
                onOpenChange={(value) => {
                    if (!value && !deleting) {
                        setPendingDelete(null);
                    }
                }}
            >
                <DialogContent
                    className="sm:max-w-md"
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        restoreFocus(deleteTrigger.current);
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Hapus banner?</DialogTitle>
                        <DialogDescription>
                            {pendingDelete
                                ? `"${pendingDelete.name}" akan dihapus permanen, termasuk berkas gambarnya. Tindakan ini tidak bisa dibatalkan.`
                                : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={deleting}
                            onClick={() => setPendingDelete(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={deleting}
                            onClick={confirmDelete}
                        >
                            {deleting ? 'Menghapus…' : 'Hapus banner'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}

function BannerEditor({
    banner,
    onSaved,
}: {
    banner: Banner | null;
    onSaved: () => void;
}) {
    const form = useForm({
        name: banner?.name ?? '',
        alt_text: banner?.alt_text ?? '',
        image: null as File | null,
        target_path:
            banner?.target_path ?? (banner ? '' : '/customer/products'),
        sort_order: String(banner?.sort_order ?? 0),
        is_active: banner?.is_active ?? false,
    });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    useEffect(
        () => () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        },
        [previewUrl],
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (form.processing) {
            return;
        }

        form.transform((data) => (banner ? { ...data, _method: 'put' } : data));
        form.post(banner ? `/owner/banners/${banner.id}` : '/owner/banners', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: onSaved,
        });
    };
    const error = (field: keyof typeof form.data) =>
        form.errors[field] ? (
            <p
                id={`banner-${field}-error`}
                className="mt-1 text-sm text-destructive"
                role="alert"
            >
                {form.errors[field]}
            </p>
        ) : null;
    const fieldProps = (field: keyof typeof form.data) => ({
        id: `banner-${field}`,
        'aria-invalid': !!form.errors[field],
        'aria-describedby':
            [
                field === 'image'
                    ? 'banner-image-help'
                    : field === 'alt_text'
                      ? 'banner-alt-help'
                      : field === 'target_path'
                        ? 'banner-target-help'
                        : '',
                form.errors[field] ? `banner-${field}-error` : '',
            ]
                .filter(Boolean)
                .join(' ') || undefined,
    });
    const preview = previewUrl ?? banner?.image_url;

    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    {banner ? 'Edit banner' : 'Tambah banner'}
                </DialogTitle>
                <DialogDescription>
                    Gambar tampil utuh di beranda customer. Semua pesan promosi
                    harus ada di desain dan teks alternatif.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5">
                <fieldset
                    disabled={form.processing}
                    className="min-w-0 space-y-5 disabled:opacity-70"
                >
                    <div>
                        <label
                            htmlFor="banner-name"
                            className="mb-1 block text-sm font-medium"
                        >
                            Nama internal
                        </label>
                        <Input
                            {...fieldProps('name')}
                            required
                            maxLength={100}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                        />
                        {error('name')}
                    </div>
                    <div>
                        <label
                            htmlFor="banner-image"
                            className="mb-1 block text-sm font-medium"
                        >
                            Gambar{' '}
                            {banner ? '(opsional jika tidak diganti)' : ''}
                        </label>
                        <Input
                            {...fieldProps('image')}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            required={!banner}
                            onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                form.setData('image', file);
                                setPreviewUrl(
                                    file ? URL.createObjectURL(file) : null,
                                );
                            }}
                        />
                        <p
                            id="banner-image-help"
                            className="mt-1 text-xs text-text-muted"
                        >
                            JPEG, PNG, atau WebP, maksimum 5 MB. Rasio 5:2;
                            minimum 600 × 240 px, maksimum 4000 px per sisi.
                            Rekomendasi 1200 × 480 px.
                        </p>
                        {error('image')}
                    </div>
                    {preview && (
                        <div>
                            <p className="mb-2 text-sm font-medium">
                                Preview gambar
                            </p>
                            <BannerImage
                                key={preview}
                                slide={{
                                    id: 'preview',
                                    image_url: preview,
                                    alt_text:
                                        form.data.alt_text || 'Preview banner',
                                    target_path: null,
                                }}
                            />
                        </div>
                    )}
                    <div>
                        <label
                            htmlFor="banner-alt_text"
                            className="mb-1 block text-sm font-medium"
                        >
                            Teks alternatif
                        </label>
                        <Input
                            {...fieldProps('alt_text')}
                            required
                            maxLength={500}
                            value={form.data.alt_text}
                            onChange={(event) =>
                                form.setData('alt_text', event.target.value)
                            }
                        />
                        <p
                            id="banner-alt-help"
                            className="mt-1 text-xs text-text-muted"
                        >
                            Tuliskan pesan penting dalam gambar untuk pengguna
                            pembaca layar.
                        </p>
                        {error('alt_text')}
                    </div>
                    <div>
                        <label
                            htmlFor="banner-target_path"
                            className="mb-1 block text-sm font-medium"
                        >
                            Tujuan klik (opsional)
                        </label>
                        <Input
                            {...fieldProps('target_path')}
                            maxLength={2048}
                            placeholder="/customer/products"
                            value={form.data.target_path}
                            onChange={(event) =>
                                form.setData('target_path', event.target.value)
                            }
                        />
                        <p
                            id="banner-target-help"
                            className="mt-1 text-xs text-text-muted"
                        >
                            Hanya path /customer/ internal. Kosongkan untuk
                            gambar tanpa tautan.
                        </p>
                        {error('target_path')}
                    </div>
                    <div>
                        <label
                            htmlFor="banner-sort_order"
                            className="mb-1 block text-sm font-medium"
                        >
                            Urutan
                        </label>
                        <Input
                            {...fieldProps('sort_order')}
                            type="number"
                            required
                            min={0}
                            max={9999}
                            step={1}
                            value={form.data.sort_order}
                            onChange={(event) =>
                                form.setData('sort_order', event.target.value)
                            }
                        />
                        {error('sort_order')}
                    </div>
                    <div>
                        <div className="flex min-h-11 items-center gap-3">
                            <Checkbox
                                {...fieldProps('is_active')}
                                checked={form.data.is_active}
                                onChange={(event) =>
                                    form.setData(
                                        'is_active',
                                        event.target.checked,
                                    )
                                }
                            />
                            <label
                                htmlFor="banner-is_active"
                                className="cursor-pointer text-sm font-medium"
                            >
                                Aktif — tampilkan ke customer
                            </label>
                        </div>
                        {error('is_active')}
                    </div>
                </fieldset>
                {form.progress && (
                    <p role="status" className="text-sm text-text-muted">
                        Mengunggah {form.progress.percentage ?? 0}%
                    </p>
                )}
                {form.hasErrors && (
                    <p role="alert" className="text-sm text-destructive">
                        Banner belum disimpan. Periksa kolom yang ditandai.
                    </p>
                )}
                <DialogFooter>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? 'Menyimpan…' : 'Simpan banner'}
                    </Button>
                </DialogFooter>
            </form>
        </>
    );
}
