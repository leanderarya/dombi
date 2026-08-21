---
name: Dombi Operational Commerce System
description: Operational & Analytics Dashboard for Dombi Goat Milk Commerce
colors:
    primary: '#005D42'
    primary-hover: '#004833'
    accent: '#FF8A3D'
    background: '#F4F4F2'
    surface: '#FFFFFF'
    text-primary: '#1E1E1E'
    text-secondary: '#71717A'
    border: '#E4E4E7'
    success: '#22C55E'
    warning: '#F59E0B'
    error: '#EF4444'
typography:
    h1:
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif'
        fontSize: '1.5rem'
        fontWeight: '700'
        lineHeight: '1.2'
    h2:
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif'
        fontSize: '1.125rem'
        fontWeight: '600'
        lineHeight: '1.3'
    kpi-number:
        fontFamily: 'Plus Jakarta Sans, sans-serif'
        fontSize: '1.75rem'
        fontWeight: '700'
        fontVariantNumeric: 'tabular-nums'
    body-md:
        fontFamily: 'Inter, system-ui, sans-serif'
        fontSize: '0.875rem'
        fontWeight: '400'
        lineHeight: '1.5'
rounded:
    sm: '6px'
    md: '10px'
    lg: '16px'
    full: '9999px'
spacing:
    xs: '4px'
    sm: '8px'
    md: '16px'
    lg: '24px'
    xl: '32px'
components:
    card:
        backgroundColor: '{colors.surface}'
        rounded: '{rounded.lg}'
        border: '1px solid {colors.border}'
        padding: '{spacing.lg}'
    button-primary:
        backgroundColor: '{colors.primary}'
        textColor: '#FFFFFF'
        rounded: '{rounded.md}'
        padding: '10px 18px'
    badge:
        rounded: '{rounded.full}'
        padding: '4px 10px'
        fontSize: '0.75rem'
---

## Overview

Dombi Operational Commerce System dirancang untuk pengelolaan operasional harian rantai pasok susu kambing. Fokus utama desain adalah keterbacaan data instan (_scannability_), kecepatan akses aksi operasional, dan kemudahan navigasi baik di desktop maupun perangkat mobile (PWA via Capacitor).

## Color Strategy

- **Primary Emerald (`#005D42`)**: Mewakili kesegaran, kebersihan, dan nilai natural produk susu kambing. Digunakan untuk branding, sidebar active state, dan button operasional utama.
- **Accent Orange (`#FF8A3D`)**: Digunakan secara hemat khusus untuk aksi pembuatan data baru (e.g., "+ Buat Pesanan Baru", "+ Tambah Stok").
- **Background Gray (`#F4F4F2`)**: Memberikan nuansa warm-clean dan mengurangi kelelahan mata saat mengoperasikan dashboard dalam durasi lama.

## Typography Guidelines

- Gunakan **tabular figures** (`font-variant-numeric: tabular-nums`) untuk semua angka kuantitas susu (Liter), nominal uang (Rupiah), dan ID Pesanan agar mudah dibandingkan secara vertikal pada tabel dan KPI.

## Mobile & PWA Accessibility

- Karena target aplikasi adalah PWA / Capacitor Android:
    - Sidebar `w-56` berubah menjadi Bottom Navigation Bar di mobile.
    - Setiap elemen interaktif wajib memiliki _touch target_ minimal **44x44px**.
    - Menggunakan _Skeleton Screen_ saat pengolahan data Inertia.js (_page transitions_).

## Rules to Never Break

- DILARANG menggunakan background pure black (`#000000`) atau pure white (`#FFFFFF`) untuk canvas utama.
- DILARANG menyembunyikan status stok kritis (susu segar memiliki _shelf-life_ pendek) tanpa indikator warna jelas.
- SELALU gunakan format angka lokal Indonesia (`Rp xx.xxx` dan `xx Liter`).
