# Dombi App — Owner UI/UX Improvement Plan (v2, Matang)

<aside>
🎯

**Goal:** Standarisasi & peningkatan UI/UX halaman Owner Dombi App dengan fondasi **design token semantik**, shared component berbasis cva, copywriting Indonesia yang konsisten, dan perbaikan aksesibilitas — bukan sekadar swap warna.

</aside>

## Ringkasan eksekutif

Plan v1 fokus mengganti `slate-*` → `zinc-*` di 25 file. Itu memperbaiki *gejala*, bukan *akar masalah*. Versi matang ini mengubah pendekatan:

- **Fondasi dulu, baru permukaan** — definisikan token semantik di Tailwind v4 `@theme`, lalu komponen mereferensikan token (`border-border`, `text-muted`), sehingga perubahan warna/dark mode/rebrand cukup di **satu tempat**.
- **Component + migrasi call-site** — bukan hanya membuat `<Button>`, tapi memigrasikan semua pemakaian dan mengunci dengan lint rule agar tidak ada styling tombol mentah.
- **Aksesibilitas sebagai requirement**, bukan opsi.

**Tech stack:** React 19, TypeScript, Tailwind CSS 4, Inertia.js, shadcn/ui (sudah ada di stack).

---

## Prinsip desain

1. **Single source of truth** — warna, radius, spacing, tipografi hidup sebagai token, bukan nilai literal yang tersebar.
2. **Semantic over literal** — komponen tahu `surface`/`border`/`muted`, tidak tahu `zinc-200`.
3. **Composition over duplication** — satu komponen, banyak pemakaian; varian via `cva`.
4. **Accessible by default** — label terhubung, kontras AA, `focus-visible`.
5. **Tokenkan dulu, debat warna kemudian** — keputusan warna jadi murah diubah.

---

## Fase 0 — Audit & guardrail (prasyarat)

- [ ]  Petakan pemakaian komponen `ui/` shared (`data-table`, `empty-state`, `status-badge`) **di luar folder Owner** agar perubahan tidak menimbulkan regresi tak terduga.

```bash
grep -rl "data-table\|empty-state\|status-badge" resources/js --include="*.tsx" | grep -v "/owner/"
```

- [ ]  Inventarisasi seluruh varian warna/radius/tinggi tombol saat ini (baseline).
- [ ]  Siapkan Storybook (atau halaman /sandbox) untuk 3 komponen baru → review visual cepat.
- [ ]  Sepakati definisi token (lihat Fase 1) sebelum sentuh komponen apa pun.

---

## Fase 1 — Fondasi design token (Tailwind v4 `@theme`)

**Goal:** Token semantik jadi sumber kebenaran tunggal.

```css
/* resources/css/app.css */
@theme {
  /* Neutral — putuskan zinc vs stone di sini SAJA */
  --color-surface:      #ffffff;
  --color-surface-muted: var(--color-zinc-50);
  --color-border:       var(--color-zinc-200);
  --color-border-strong: var(--color-zinc-300);
  --color-text:         var(--color-zinc-900);
  --color-text-muted:   var(--color-zinc-500);  /* AA-safe utk teks */
  --color-text-subtle:  var(--color-zinc-400);  /* ikon dekoratif saja */

  /* Brand */
  --color-primary:      var(--color-emerald-700);
  --color-primary-hover: var(--color-emerald-800);

  /* Radius */
  --radius-card:  0.75rem;  /* rounded-xl */
  --radius-control: 0.5rem; /* rounded-lg: button & input */
  --radius-chip:  0.375rem; /* rounded-md: badge */
}
```

- [ ]  Definisikan token netral, brand, radius, dan (opsional) elevation.
- [ ]  Dokumentasikan pemetaan token → kapan pakai yang mana.

<aside>
⚠️

**Catatan warna:** Rasional v1 "zinc lebih kontras dari slate" keliru — luminansi keduanya hampir sama, bedanya hanya suhu hue. Pilih berdasarkan brand: `zinc` (netral dingin) cocok untuk admin tool; `stone` (hangat) lebih selaras nuansa organik/premium Dombi. Karena sudah ditokenkan, keputusan ini murah diubah.

</aside>

---

## Fase 2 — Migrasi warna literal → token semantik

**Goal:** Hapus warna mentah dari komponen, ganti dengan utility token.

- [ ]  Ganti `slate-*`/`zinc-*` literal → `border-border`, `text-muted`, `bg-surface`, dst.
- [ ]  Gunakan regex word-boundary agar aman (hindari kena substring lain):

```bash
# Audit dulu, jangan langsung sed buta
grep -rnE "\b(slate|zinc)-[0-9]{2,3}" resources/js/components resources/js/pages --include="*.tsx"
```

- [ ]  Review diff per file; perhatikan komponen shared yang dipakai lintas-role.
- [ ]  Verifikasi: tidak ada warna netral literal tersisa di scope.

```bash
grep -rnE "\b(slate|zinc|gray)-[0-9]" resources/js/components/owner resources/js/pages/owner --include="*.tsx" | wc -l  # target: 0
```

---

## Fase 3 — Shared component (cva + cn + token)

**Goal:** Komponen reusable berbasis `class-variance-authority` + `cn()` (clsx + tailwind-merge), selaras shadcn/ui yang sudah dipakai.

### 3a. Utility `cn()`

- [ ]  Tambah `lib/utils.ts` dengan `cn = (...) => twMerge(clsx(...))` bila belum ada.

### 3b. Button

- [ ]  Varian via `cva`: `primary | secondary | danger | ghost`; size `sm | md | lg`.
- [ ]  Dukung **render sebagai link** (Inertia `<Link>`) via pola `asChild`/Slot — banyak CTA sebenarnya navigasi (hero, empty-state).
- [ ]  A11y: `focus-visible:ring`, `aria-busy` saat loading, `disabled` saat loading.
- [ ]  Pakai token: `bg-primary hover:bg-primary-hover`, radius `--radius-control`.

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary',
        secondary: 'border border-border text-text hover:bg-surface-muted',
        danger:    'border border-red-200 text-red-700 hover:bg-red-50',
        ghost:     'text-text hover:bg-surface-muted',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-[--radius-chip]',
        md: 'h-9 px-4 text-sm rounded-[--radius-control]',
        lg: 'h-11 px-6 text-sm rounded-[--radius-control]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
```

### 3c. Input & Select (a11y wajib)

- [ ]  `label` terhubung ke field via `useId()` (`htmlFor`/`id`) — ini bug nyata di v1.
- [ ]  `aria-invalid` + `aria-describedby` menunjuk teks error.
- [ ]  State error pakai token, placeholder `text-subtle`, teks bermakna `text-muted` (bukan `-400`).
- [ ]  SearchInput = Input + ikon, jangan komponen terpisah yang duplikatif.

---

## Fase 4 — Migrasi call-site (langkah yang hilang di v1)

**Goal:** Ganti semua styling mentah dengan shared component. Tanpa ini, duplikasi tetap ada → dua sumber kebenaran.

- [ ]  Ganti seluruh tombol manual (`Tambah`, hero CTA, empty-state CTA, modal submit, table actions) → `<Button>`.
- [ ]  Ganti input/select manual → `<Input>` / `<Select>`.
- [ ]  Tambah **lint rule / grep CI** yang melarang class tombol mentah (mis. `bg-emerald-700` di luar komponen Button).

```bash
grep -rn "bg-emerald-700" resources/js/pages resources/js/components --include="*.tsx" | grep -v "button.tsx"  # target: 0
```

---

## Fase 5 — Komponen shell, kartu & tabel

- [ ]  **OwnerPageShell**: judul `text-xl font-semibold tracking-tight text-text`; subtitle `text-sm text-muted mt-0.5`.
- [ ]  **OwnerKpiCard**: border token + `hover:border-border-strong`; value `text-2xl font-bold tabular-nums tracking-tight` (jangan tumpuk efek berlebihan).
- [ ]  **OwnerActionCard**: pindah ke token, hapus literal `slate`.
- [ ]  **DataTable / EmptyState / StatusBadge**: pindah ke token; EmptyState CTA pakai `<Button size="lg">` (bukan class manual).
- [ ]  Tambah **skeleton/loading state** untuk KPI & tabel; samakan triad **empty / error / loading**.

---

## Fase 6 — Copywriting & i18n

- [ ]  Terjemahkan label nav: `Returns` → `Pengembalian`, `Exchanges` → `Penukaran`, grup `Dashboard` → `Dasbor` (jangan sisakan 1 kata EN di nav full-ID). Pertahankan **SKU, KPI**.
- [ ]  Tambah subtitle yang hilang: Pesanan, Inventaris, Pergerakan Stok.
- [ ]  Perbaiki copy dashboard agar deskriptif ("Ringkasan operasional & keputusan yang perlu diambil").
- [ ]  **Util format IDR & tanggal locale `id-ID`** (pemisah ribuan, `Rp`) — penting untuk dashboard commerce; pasangkan dengan `tabular-nums`.

---

## Fase 7 — Aksesibilitas (acceptance criteria)

- [ ]  Semua field form: label terasosiasi + `aria-invalid`/`aria-describedby`.
- [ ]  Semua interaktif: `focus-visible` ring terlihat; tombol icon-only punya `aria-label`.
- [ ]  Kontras teks ≥ 4.5:1 (AA) — teks bermakna minimal `text-muted` (zinc-500), bukan `-400`.
- [ ]  Navigasi keyboard penuh di tabel, modal, dropdown (focus trap di modal).

---

## Verifikasi & QA

- [ ]  `npm run build` & `php artisan test` lulus.
- [ ]  **Review visual** via Storybook/screenshot diff (test unit tidak menangkap regresi visual).
- [ ]  Cek regresi di halaman **non-owner** yang memakai komponen shared.
- [ ]  Audit a11y otomatis (axe) pada halaman Owner utama.
- [ ]  Checklist manual: dashboard, KPI, action card, tabel, button, form, empty state, nav ID, subtitle, tipografi.

---

## Keputusan desain (final)

| Topik | Keputusan | Alasan |
| --- | --- | --- |
| Warna netral | Tokenkan; default `zinc`, pertimbangkan `stone` utk nuansa premium | Murah diubah karena semantic token |
| Tipografi | Public Sans menyeluruh | Dashboard padat-data; display font menambah beban tanpa manfaat |
| Hero CTA | `emerald-600` di atas latar gelap | Brand-consistent + kontras cukup (zinc-900 tenggelam) |
| Nav label | Full Indonesia, `Dasbor` | Konsistensi bahasa; SKU/KPI tetap |
| Radius | `xl` card · `lg` control · `md` chip | Hindari `2xl` di UI padat-data |
| Strategi komponen | Shared + cva + cn (≈ shadcn) | Hindari reinvent; konsisten dgn stack |
| Responsiveness | Responsive (sertakan tablet) | Owner sering pakai tablet |
| Animasi | Minimal (`transition-colors`  • hover) | Tool operasional, hindari berlebihan |

---

## Roadmap & estimasi

| Fase | Fokus | Est. |
| --- | --- | --- |
| 0 | Audit & guardrail | 0.5 hari |
| 1 | Token `@theme` | 0.25 hari |
| 2 | Migrasi warna → token | 0.5 hari |
| 3 | Shared component (cva+a11y) | 0.75 hari |
| 4 | Migrasi call-site + lint | 0.5 hari |
| 5 | Shell/kartu/tabel + loading | 0.5 hari |
| 6 | Copywriting + util IDR/locale | 0.5 hari |
| 7 | A11y pass | 0.25 hari |
| QA | Visual + regresi + axe | 0.5 hari |
| **Total** |  | **~4.25 hari** |

<aside>
📌

Estimasi v1 (~7 jam) terlalu optimistis karena tidak menghitung migrasi call-site, fix a11y, dan QA visual. Angka di atas lebih realistis.

</aside>

---

## Backlog (di luar scope awal, dipertimbangkan berikutnya)

- Dark mode (otomatis lebih mudah berkat token semantik).
- Konsistensi toast/notifikasi.
- Sistem elevation/shadow yang ditokenkan.
- Audit performa bundle setelah penambahan komponen.