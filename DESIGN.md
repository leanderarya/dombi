# Dombi Design System

Version: 1.0

---

# Philosophy

Dombi is a mobile-first operational commerce platform.

Every role must feel like they are using the same product.

Roles:

- Customer
- Owner
- Outlet
- Courier

may have different responsibilities but must share the same visual language.

The Customer experience is the primary design reference.

When in doubt:

Follow Customer UI patterns.

Do not invent a new design language.

---

# Design Principles

1. Mobile First
2. Fast Scanning
3. Operational Simplicity
4. Large Touch Targets
5. Minimal Cognitive Load
6. Consistent Navigation
7. Consistent Components
8. High Readability

---

# Supported Viewports

Primary:

- 360x800
- 390x844
- 412x915

Secondary:

- Tablet Landscape
- Desktop

Design for mobile first.

Desktop adapts from mobile.

Never design desktop-first pages.

---

# Visual Personality

Dombi should feel:

- Clean
- Modern
- Friendly
- Operational
- Fast

Avoid:

- Enterprise dashboard look
- Heavy admin panels
- Dense data tables
- Complex multi-column layouts

---

# Layout Rules

Maximum content width:

```text
max-w-screen-md
```

Use:

```text
px-4
sm:px-6
```

Default vertical spacing:

```text
space-y-4
```

Avoid excessive nesting.

---

# Page Structure

Every page should follow:

Header

↓

Main Content

↓

Bottom Navigation (mobile)

---

# Header Standard

Height:

```text
56px
```

Structure:

Title

Optional Subtitle

Optional Action

Examples:

Customer:

```text
Beranda
```

Courier:

```text
Tugas Saya
```

Owner:

```text
Pengiriman
```

Outlet:

```text
Pesanan
```

Do not create different header systems per role.

---

# Card System

Cards are the primary UI container.

Use:

- Rounded corners
- Soft border
- Compact hierarchy
- Comfortable spacing

Cards must be:

Easy to scan

Never overloaded with information.

---

# Typography

Hierarchy:

Page Title

↓

Section Title

↓

Primary Content

↓

Secondary Content

↓

Meta Information

Avoid:

Tiny text

Low contrast text

Excessive font weights

---

# Color System

Use one shared color system.

Primary

Success

Warning

Danger

Neutral

Do not introduce role-specific color palettes.

Example:

Courier ≠ Orange Theme

Owner ≠ Purple Theme

Outlet ≠ Green Theme

Everything must remain Dombi.

---

# Button System

Three levels only.

Primary

Secondary

Ghost

Do not introduce additional button styles.

---

# Action Placement

Primary action:

Bottom of card

or

Sticky bottom area

Examples:

Checkout

Assign Courier

Confirm Delivery

Confirm Return

---

# Badge System

Standard badges:

Pending

Success

Warning

Danger

Info

Reuse across all roles.

Do not create custom badge systems.

---

# Empty State Rules

Every empty state must include:

Icon

Title

Description

Primary Action

Examples:

Belum Ada Pesanan

Mulai Belanja

---

# Loading State Rules

Use:

Skeleton loaders

Avoid:

Spinners blocking the entire screen

---

# Bottom Navigation

Shared behavior.

Customer:

Beranda
Produk
Pesanan
Pengaturan

Courier:

Tugas Saya
Riwayat

Owner:

Dashboard
Pesanan
Pengiriman
Inventaris
Lainnya

Outlet:

Dashboard
Pesanan
Pengiriman
Lainnya

Navigation patterns must remain consistent.

---

# Sheet & Modal System

Use Bottom Sheet first.

Use Full Page second.

Avoid desktop-style modal dialogs.

Bottom Sheets are preferred for:

- Filters
- Actions
- Confirmation
- Status Updates

---

# Form Design

Use:

Single-column forms

Large inputs

Clear labels

Helpful validation

Avoid:

Dense multi-column layouts

---

# Mobile Touch Targets

Minimum:

44px

Preferred:

48px+

Buttons must remain usable while:

- walking
- riding
- operating with one hand

Especially for Courier.

---

# Data Presentation

Prefer:

Cards

Lists

Grouped Sections

Avoid:

Large tables

Wide grids

Desktop-first reporting layouts

---

# Role Consistency Rules

Customer UI is the reference implementation.

Owner

Outlet

Courier

must reuse:

- spacing
- cards
- typography
- buttons
- badges
- sheets
- loading states
- empty states

before creating new patterns.

---

# New Feature Rule

Before creating any new component:

Ask:

"Can this reuse an existing Customer component?"

If yes:

Reuse.

If no:

Create shared component.

Avoid role-specific implementations.

---

# Final Design Goal

When switching between:

Customer
Owner
Outlet
Courier

the user should immediately recognize:

"This is Dombi."

The product should feel like one system with different responsibilities, not four separate applications.
