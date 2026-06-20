# Dombi Landing Page - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public landing page for Dombi that showcases goat milk products and brand, matching the customer app design language

**Architecture:** New landing page route + controller + Inertia page, using existing product data from database

**Tech Stack:** Laravel 13, React 19, Inertia.js, Tailwind CSS, Lucide Icons

---

## Product Data (from ProductCatalogSeeder)

| Family | Brand | Variants | Price Range |
|--------|-------|----------|-------------|
| Domilk Original | Domilk | Original 250ml, 1L | Rp12.000 - Rp42.000 |
| Domilk Premium Taste | Domilk | Coklat, Vanilla, Stroberi, Coffee (250ml, 1L) | Rp15.000 - Rp48.000 |
| Biogoat | Biogoat | Original 250ml, 1L | Rp13.000 - Rp45.000 |
| Raw Milk by Domilk | Domilk | Fresh 1L | Rp30.000 |

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `routes/web.php` | Modify | Add landing page route |
| `app/Http/Controllers/LandingController.php` | Create | Controller for landing page |
| `resources/js/pages/landing.tsx` | Create | Main landing page |
| `resources/js/components/landing/header.tsx` | Create | Sticky header |
| `resources/js/components/landing/hero-section.tsx` | Create | Hero section |
| `resources/js/components/landing/benefits-section.tsx` | Create | Benefits section |
| `resources/js/components/landing/products-section.tsx` | Create | Products showcase |
| `resources/js/components/landing/steps-section.tsx` | Create | How to order steps |
| `resources/js/components/landing/testimonials-section.tsx` | Create | Testimonials |
| `resources/js/components/landing/about-section.tsx` | Create | About Dombi |
| `resources/js/components/landing/footer-section.tsx` | Create | Footer |

---

### Task 1: Create Landing Controller & Route

**Files:**
- Create: `app/Http/Controllers/LandingController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Create LandingController**

```php
<?php

namespace App\Http\Controllers;

use App\Models\ProductFamily;
use Inertia\Inertia;
use Inertia\Response;

class LandingController extends Controller
{
    public function __invoke(): Response
    {
        $products = ProductFamily::query()
            ->with(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('selling_price')])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('landing', [
            'products' => $products,
        ]);
    }
}
```

- [ ] **Step 2: Add route**

Add to `routes/web.php` BEFORE the customer.inertia group:

```php
Route::get('/landing', \App\Http\Controllers\LandingController::class)->name('landing');
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/LandingController.php routes/web.php
git commit -m "feat: add landing page controller and route"
```

---

### Task 2: Create Landing Page Component

**Files:**
- Create: `resources/js/pages/landing.tsx`

- [ ] **Step 1: Create main landing page**

```tsx
import { Head } from '@inertiajs/react';
import Header from '@/components/landing/header';
import HeroSection from '@/components/landing/hero-section';
import BenefitsSection from '@/components/landing/benefits-section';
import ProductsSection from '@/components/landing/products-section';
import StepsSection from '@/components/landing/steps-section';
import TestimonialsSection from '@/components/landing/testimonials-section';
import AboutSection from '@/components/landing/about-section';
import FooterSection from '@/components/landing/footer-section';

interface Props {
    products: any[];
}

export default function Landing({ products }: Props) {
    return (
        <>
            <Head title="Dombi - Susu Kambing Segar" />
            <div className="min-h-screen bg-[#fbf9f7]">
                <Header />
                <HeroSection />
                <BenefitsSection />
                <ProductsSection products={products} />
                <StepsSection />
                <TestimonialsSection />
                <AboutSection />
                <FooterSection />
            </div>
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/landing.tsx
git commit -m "feat: create landing page component"
```

---

### Task 3: Create Header Component

**Files:**
- Create: `resources/js/components/landing/header.tsx`

- [ ] **Step 1: Create header**

```tsx
import { Link } from '@inertiajs/react';

export default function Header() {
    return (
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <Link href="/landing" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">D</div>
                    <span className="text-lg font-bold text-zinc-900">Dombi</span>
                </Link>
                <Link
                    href="/customer/products"
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm active:bg-emerald-700"
                >
                    Pesan Sekarang
                </Link>
            </div>
        </header>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/header.tsx
git commit -m "feat: create landing page header component"
```

---

### Task 4: Create Hero Section

**Files:**
- Create: `resources/js/components/landing/hero-section.tsx`

- [ ] **Step 1: Create hero section**

```tsx
import { Link } from '@inertiajs/react';

export default function HeroSection() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden opacity-10">
                <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white" />
                <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-white" />
                <div className="absolute bottom-8 right-8 h-32 w-32 rounded-full bg-white" />
            </div>

            <div className="relative mx-auto max-w-lg px-6 py-16 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <span className="text-4xl font-bold text-white">D</span>
                </div>
                <h1 className="text-3xl font-bold leading-tight text-white">
                    Susu Kambing Segar
                </h1>
                <p className="mt-3 text-lg text-white/80">
                    Langsung dari peternakan, kualitas terbaik untuk keluarga Anda
                </p>
                <Link
                    href="/customer/products"
                    className="mt-8 inline-flex rounded-full bg-white px-8 py-3 text-sm font-bold text-emerald-700 shadow-lg transition-all active:scale-95"
                >
                    Pesan Sekarang
                </Link>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/hero-section.tsx
git commit -m "feat: create landing page hero section"
```

---

### Task 5: Create Benefits Section

**Files:**
- Create: `resources/js/components/landing/benefits-section.tsx`

- [ ] **Step 1: Create benefits section**

```tsx
import { Droplets, Truck, ShieldCheck } from 'lucide-react';

const benefits = [
    {
        icon: Droplets,
        title: 'Segar & Alami',
        description: 'Diproduksi dari peternakan sendiri tanpa bahan pengawet',
        color: 'bg-emerald-50 text-emerald-600',
    },
    {
        icon: Truck,
        title: 'Pengiriman Cepat',
        description: 'Diantar langsung ke rumah Anda di hari yang sama',
        color: 'bg-blue-50 text-blue-600',
    },
    {
        icon: ShieldCheck,
        title: 'Kualitas Terjamin',
        description: 'Sertifikasi Halal & izin usaha lengkap',
        color: 'bg-purple-50 text-purple-600',
    },
];

export default function BenefitsSection() {
    return (
        <section className="px-6 py-12">
            <div className="mx-auto max-w-lg">
                <h2 className="mb-6 text-center text-xl font-bold text-zinc-900">
                    Mengapa Dombi?
                </h2>
                <div className="space-y-4">
                    {benefits.map((benefit) => {
                        const Icon = benefit.icon;
                        return (
                            <div
                                key={benefit.title}
                                className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                            >
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${benefit.color}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-zinc-900">{benefit.title}</div>
                                    <div className="mt-0.5 text-xs text-zinc-500">{benefit.description}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/benefits-section.tsx
git commit -m "feat: create landing page benefits section"
```

---

### Task 6: Create Products Section

**Files:**
- Create: `resources/js/components/landing/products-section.tsx`

- [ ] **Step 1: Create products section with real product data**

```tsx
import { Link } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format';

interface Variant {
    id: number;
    name: string;
    selling_price: number;
}

interface ProductFamily {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    variants: Variant[];
}

interface Props {
    products: ProductFamily[];
}

export default function ProductsSection({ products }: Props) {
    return (
        <section className="px-6 py-12">
            <div className="mx-auto max-w-lg">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-zinc-900">Produk Kami</h2>
                    <Link href="/customer/products" className="text-sm font-medium text-emerald-600">
                        Lihat Semua →
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {products.map((family) => {
                        const variant = family.variants?.[0];
                        if (!variant) return null;

                        return (
                            <Link
                                key={family.id}
                                href={`/customer/products/${family.id}`}
                                className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm active:bg-zinc-50"
                            >
                                <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-zinc-50">
                                    <span className="text-4xl">🐐</span>
                                </div>
                                <div className="text-sm font-semibold text-zinc-900">{family.name}</div>
                                <div className="mt-0.5 text-xs text-zinc-500">{family.brand}</div>
                                <div className="mt-2 text-base font-bold text-emerald-700">
                                    {formatCurrency(variant.selling_price)}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/products-section.tsx
git commit -m "feat: create landing page products section with real product data"
```

---

### Task 7: Create Steps Section

**Files:**
- Create: `resources/js/components/landing/steps-section.tsx`

- [ ] **Step 1: Create steps section**

```tsx
const steps = [
    {
        step: '1',
        title: 'Pilih Produk',
        description: 'Pilih susu kambing favorit Anda dari katalog kami',
    },
    {
        step: '2',
        title: 'Checkout',
        description: 'Pilih pickup atau delivery, bayar dengan mudah',
    },
    {
        step: '3',
        title: 'Terima Pesanan',
        description: 'Pesanan diantar ke rumah atau ambil di outlet',
    },
];

export default function StepsSection() {
    return (
        <section className="bg-emerald-50 px-6 py-12">
            <div className="mx-auto max-w-lg">
                <h2 className="mb-6 text-center text-xl font-bold text-zinc-900">
                    Cara Pemesanan
                </h2>
                <div className="space-y-4">
                    {steps.map((step) => (
                        <div key={step.step} className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                                {step.step}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-zinc-900">{step.title}</div>
                                <div className="text-xs text-zinc-500">{step.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/steps-section.tsx
git commit -m "feat: create landing page steps section"
```

---

### Task 8: Create Testimonials Section

**Files:**
- Create: `resources/js/components/landing/testimonials-section.tsx`

- [ ] **Step 1: Create testimonials section**

```tsx
const testimonials = [
    {
        name: 'Ibu Sarah',
        location: 'Semarang',
        text: 'Susu kambing Dombi sangat segar dan anak-anak suka. Pengiriman juga cepat!',
        rating: 5,
    },
    {
        name: 'Budi Santoso',
        location: 'Jakarta',
        text: 'Kualitas susu kambing terbaik yang pernah saya coba. Sangat recommended!',
        rating: 5,
    },
    {
        name: 'Ibu Rina',
        location: 'Bandung',
        text: 'Pelayanan ramah, produk berkualitas. Sudah langganan sejak lama.',
        rating: 5,
    },
];

export default function TestimonialsSection() {
    return (
        <section className="px-6 py-12">
            <div className="mx-auto max-w-lg">
                <h2 className="mb-6 text-center text-xl font-bold text-zinc-900">
                    Apa Kata Mereka
                </h2>
                <div className="space-y-4">
                    {testimonials.map((t) => (
                        <div key={t.name} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                            <div className="mb-2 flex items-center gap-1">
                                {Array.from({ length: t.rating }).map((_, i) => (
                                    <span key={i} className="text-sm text-amber-400">★</span>
                                ))}
                            </div>
                            <p className="text-sm text-zinc-700">"{t.text}"</p>
                            <div className="mt-3 text-xs font-semibold text-zinc-900">{t.name}</div>
                            <div className="text-[10px] text-zinc-400">{t.location}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/testimonials-section.tsx
git commit -m "feat: create landing page testimonials section"
```

---

### Task 9: Create About Section

**Files:**
- Create: `resources/js/components/landing/about-section.tsx`

- [ ] **Step 1: Create about section**

```tsx
export default function AboutSection() {
    return (
        <section className="bg-emerald-50 px-6 py-12">
            <div className="mx-auto max-w-lg text-center">
                <h2 className="mb-4 text-xl font-bold text-zinc-900">Tentang Dombi</h2>
                <p className="text-sm leading-relaxed text-zinc-600">
                    Dombi adalah brand susu kambing segar yang diproduksi langsung dari peternakan sendiri.
                    Kami berkomitmen menghadirkan produk berkualitas tinggi dengan proses yang higienis
                    dan alami. Setiap tetes susu Dombi adalah hasil dari perawatan terbaik untuk
                    kambing-kambing kami.
                </p>
                <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-400">
                    <span>Sertifikasi Halal</span>
                    <span className="h-3 w-px bg-zinc-300" />
                    <span>Izin Usaha</span>
                    <span className="h-3 w-px bg-zinc-300" />
                    <span>Dombi 2024</span>
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/about-section.tsx
git commit -m "feat: create landing page about section"
```

---

### Task 10: Create Footer Section

**Files:**
- Create: `resources/js/components/landing/footer-section.tsx`

- [ ] **Step 1: Create footer section**

```tsx
import { Link } from '@inertiajs/react';

export default function FooterSection() {
    return (
        <footer className="border-t border-zinc-200 bg-white px-6 py-8">
            <div className="mx-auto max-w-lg">
                <div className="mb-6 text-center">
                    <div className="inline-flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">D</div>
                        <span className="text-lg font-bold text-zinc-900">Dombi</span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Susu Kambing Segar untuk Keluarga</p>
                </div>

                <div className="mb-6 flex justify-center gap-6">
                    <Link href="/customer/products" className="text-xs text-zinc-500 hover:text-zinc-900">Produk</Link>
                    <Link href="/customer/about" className="text-xs text-zinc-500 hover:text-zinc-900">Tentang</Link>
                    <Link href="/customer/help" className="text-xs text-zinc-500 hover:text-zinc-900">Bantuan</Link>
                </div>

                <div className="text-center text-[10px] text-zinc-400">
                    © 2024 Dombi. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/landing/footer-section.tsx
git commit -m "feat: create landing page footer section"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Test landing page at `/landing`
4. Verify all sections render correctly
5. Verify product links work
6. Verify responsive design on mobile

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Controller & Route | 0.5d |
| 2 | Landing page component | 0.5d |
| 3 | Header component | 0.5d |
| 4 | Hero section | 0.5d |
| 5 | Benefits section | 0.5d |
| 6 | Products section | 0.5d |
| 7 | Steps section | 0.5d |
| 8 | Testimonials section | 0.5d |
| 9 | About section | 0.5d |
| 10 | Footer section | 0.5d |
| **Total** | | **5d** |
