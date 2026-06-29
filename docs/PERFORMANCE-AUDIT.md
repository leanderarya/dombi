# Dombi Performance Audit

## Summary Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Controllers | 63 | OK |
| Migrations | 80 | OK |
| Eager loading (`->with()`) | 161 | Good |
| Query executions (`get()`, `first()`, `find()`) | 101 | Needs review |
| Aggregate queries (`count()`, `sum()`) | 91 | Needs review |
| Raw queries (`DB::raw`, `selectRaw`) | 29 | Needs review |
| Cache usage (`Cache::`) | 6 | Low |
| Loops in controllers | 69 | Needs review |
| Index definitions | 174 | Good |
| Dynamic imports | 7 | Low |

## Frontend Bundle Sizes

| File | Size | Status |
|------|------|--------|
| `internal-app-*.js` | 726 KB | Large |
| `esm-*.js` | 369 KB | OK |
| `login-*.js` | 356 KB | Large |
| `customer-app-*.js` | 298 KB | OK |
| `leaflet-*.js` | 149 KB | OK |
| `app-*.css` | 116 KB | OK |

## Issues Found

### 1. Large Bundle Size (726 KB)

**Problem:** `internal-app-*.js` is 726 KB which is large for initial load.

**Impact:** Slow initial page load, especially on mobile.

**Solution:**
- Implement code splitting per role (owner, outlet, courier)
- Lazy load heavy components (charts, maps, editors)
- Tree-shake unused Lucide icons

### 2. Low Cache Usage (6 instances)

**Problem:** Only 6 controller methods use `Cache::` for data caching.

**Impact:** Repeated expensive queries on every page load.

**Solution:**
- Cache dashboard KPIs (30s TTL)
- Cache outlet lists (5min TTL)
- Cache product families (1min TTL)
- Cache pending counts (5s TTL — already done for orders)

### 3. High Aggregate Query Count (91)

**Problem:** 91 aggregate queries (`count()`, `sum()`) in controllers.

**Impact:** Multiple database roundtrips per request.

**Solution:**
- Use `withCount()` instead of `->count()` in loops
- Use `withSum()` instead of `->sum()` in loops
- Pre-compute aggregates in service layer

### 4. Raw Queries (29)

**Problem:** 29 raw SQL queries (`DB::raw`, `selectRaw`, `whereRaw`).

**Impact:** Potential SQL injection, harder to maintain, database-specific.

**Solution:**
- Review each raw query for safety
- Convert to Eloquent where possible
- Use query builder methods instead of raw SQL

### 5. Potential N+1 Queries

**Problem:** 69 loops in controllers, some may contain queries.

**Impact:** N+1 queries cause exponential database load.

**Solution:**
- Audit each loop for queries inside
- Move queries to eager loading (`->with()`)
- Use `withCount()` for counts in loops

### 6. Low Dynamic Imports (7)

**Problem:** Only 7 dynamic imports in the codebase.

**Impact:** Large initial bundle, slow page loads.

**Solution:**
- Lazy load owner pages (not used by customers)
- Lazy load heavy components (charts, maps)
- Split vendor chunks (React, Inertia, Lucide)

## Recommendations

### High Priority

1. **Implement code splitting** — Split bundles by role (owner, outlet, courier, customer)
2. **Add cache layer** — Cache dashboard data, outlet lists, product families
3. **Audit N+1 queries** — Find and fix queries inside loops

### Medium Priority

4. **Convert raw queries** — Move from `DB::raw` to Eloquent
5. **Use `withCount()`** — Replace `->count()` in loops
6. **Lazy load heavy components** — Charts, maps, editors

### Low Priority

7. **Optimize images** — Use WebP, lazy loading
8. **Add Redis** — For better cache performance
9. **Implement CDN** — For static assets

## Quick Wins

1. Add `withCount()` to order queries in dashboard
2. Cache outlet list for 5 minutes
3. Lazy load Leaflet maps
4. Split owner bundle from main bundle

## Estimated Impact

| Optimization | Load Time Improvement |
|--------------|----------------------|
| Code splitting | -200ms |
| Cache layer | -100ms |
| N+1 fixes | -50ms |
| Lazy loading | -150ms |
| **Total** | **-500ms** |
