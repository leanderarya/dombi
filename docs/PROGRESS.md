# Dombi — Progress Roadmap

**Updated:** 2026-08-09
**Current Branch:** `develop`
**Status:** Implementation near-complete (62/64 PRD requirements DONE). Both release blockers resolved. Release is **GO** pending operational release evidence. See [PRD Gap Report](PRD_GAP_REPORT.md) for the full evidence-backed audit.

---

## Quick Status

| Category | Status |
|----------|--------|
| Backend core (orders, products, outlets) | ✅ Done |
| Payment integration (DOKU) | ✅ Done — idempotent webhook, retry, fee |
| Refund system | ✅ Done |
| Push notification (VAPID + FCM) | ✅ Done — VAPID web solid; FCM is thin/legacy |
| Operating hours (WIB) + holidays | ✅ Done — isOpen, nextOpenTime, auto-select OPEN outlet |
| Owner toast UX | ✅ Done — toastMutation helper |
| Guest checkout / tracking | ✅ Done — guest_token, tracking, recovery |
| Settlement FK + manual allocation | ✅ Done |
| Courier Management v2 | ✅ Done — Dombi (Pusat + Outlet) + Eksternal (Gojek/Grab) |
| Owner Analytics + CSV export | ✅ Done — ANA-1/2/3 |
| Refund UI (customer + owner) | ✅ Done — REF-1..5 |
| Product Scope launch invariants | ✅ 10/10 verified in code |
| **PRD functional coverage** | ✅ **62/64 DONE, 2 PARTIAL, 0 NOT DONE** |
| Test Suite | ✅ 1210 tests, 1210 passed, 4270 assertions |
| Frontend tests | ✅ 18 files, 62 tests |
| Frontend format/lint | ✅ format:check + lint:check pass |
| Build | ✅ `npm run build` passes |
| **TypeScript** | ✅ `npm run types:check` passes (fixture fixed) |

---

## Verification baseline (2026-08-09, branch `develop`)

| Command | Result |
|---|---|
| `php artisan test` | ✅ PASS — 1210/1210, 4270 assertions |
| `npm run format:check` | ✅ PASS |
| `npm run lint:check` | ✅ PASS |
| `npm run types:check` | ✅ PASS — fixture fixed |
| `npm run test` | ✅ PASS — 18 files, 62 tests |
| `npm run build` | ✅ PASS |

---

## What's Done

### PRD functional coverage (62/64 DONE)
Full requirement matrix with per-ID evidence is in [PRD_GAP_REPORT.md](PRD_GAP_REPORT.md). Summary by domain:
- **Customer** CUST-1..8, PAY-1..6, REF-1..5 — all DONE
- **Outlet** OUT-1..9 — 6 DONE, OUT-5 PARTIAL (no date filter)
- **Inventory** INV-1..3 — all DONE
- **Owner** OWN-1..4, STK-1..5, FIN-1..6, DEL-1..4 — 10 DONE, DEL-3 PARTIAL
- **Analytics** ANA-1..3 — all DONE
- **Courier** CR-1..5 — all DONE
- **System** SYS-1..6 — 4 DONE, SYS-1 PARTIAL (push thin)

### Product Scope launch invariants — 10/10 verified
Stock (no oversell, exact-once reservation release), payment idempotency (CAS + terminal guard), authorization scoping, order state machine, refund traceability, unpaid-order guard, ongkir/external-cost separation, courier self-scope. All present in code.

### Phases
- **Phase 1-4** (hardening, settlement, returns, inventory) — ✅
- **Phase 5** (push, operating hours, owner UX, outlet features) — ✅
- **Phase 6** (owner analytics) — ✅ charts + CSV export
- **Phase 7** (courier management v2) — ✅
- **Phase 8** (UI polish) — ✅ most; residual polish in PRD_GAP_REPORT non-blockers
- **Phase 9** (production deploy) — 🔄 **blocked on release evidence** (see below)

---

## Release Status

**Recommendation: GO** on code gates (see [PRD_GAP_REPORT.md](PRD_GAP_REPORT.md)). Both code blockers resolved:

### Blocker 1 — TypeScript check fails 🔒 **RESOLVED**
`products.build-sections.test.ts` fixture updated (added `is_recommended: false`, `image: null` to the `variant()` helper). `npm run types:check` now passes; the 3 fixture tests still pass.

### Blocker 2 — Guest-cancel rate limiting unenforced (SYS-6) 🔒 **RESOLVED**
`throttle:guest-cancel` (3/min/IP) wired to `customer.orders.cancel`. The orphaned `guest-cancel-token` limiter (depended on a removed token route) was removed. Cancel tests (20) pass.

### Release evidence still required
Operational evidence not yet present in `docs/PRODUCTION_CHECKLIST.md` / `docs/BACKUP_RESTORE.md`:
- Staging smoke journey evidence
- DOKU duplicate-webhook / sandbox matrix evidence
- Migration rehearsal
- Backup restore drill evidence (offsite restore currently **waived** for Hostinger — local only)
- Queue/scheduler/failed-job monitoring active
- Production env config + credentials provisioned
- Rollback/roll-forward rehearsal

---

## What's NOT Done / Deferred

| Item | Status | Note |
|------|--------|------|
| OUT-5 date filter on order history | PARTIAL | status filter present, date filter absent |
| DEL-3 real-time assign margin | PARTIAL | margin bar exists in pricing pages, not in assign-courier sheet |
| SYS-6 guest-cancel rate limiting | RESOLVED | `throttle:guest-cancel` wired to cancel route; token limiter removed |
| Customer return/exchange flow (REF-3/4) | Done but deferred | implemented; outside soft-launch slice per Product Scope |
| Offline sales + settlement (OUT-7/8) | Done but deferred | implemented; outside single-outlet slice |
| Offsite S3 backup + restore drill | Waived | Hostinger-only scope; local backup only |
| Advanced analytics / multi-language / PDF invoice / native app | Deferred | PRD Phase-lanjutan |

---

## Recommended Next Actions

1. **Close release evidence gaps** — staging smoke, DOKU matrix, migration rehearsal, backup restore drill, monitoring, production config.
2. **Resolve PARTIAL items** — OUT-5 date filter, DEL-3 assign margin, when in scope.

---

## Branch Strategy

```
develop (integration) — active work
  └── PRD gap audit + docs (this branch)
main (production-stable) — release
```

**Rule:** `develop`/`main` stay stable. All work must pass `php artisan test` before merge; quality gate runs on push to `develop`/`main`.

---

*Snapshot: 2026-08-09 | 1210 tests passing | build + types:check pass | release GO on code gates*