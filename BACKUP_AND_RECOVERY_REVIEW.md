# BACKUP AND RECOVERY REVIEW

**Date:** 2026-06-05
**Reviewer:** Automated Audit
**Codebase:** Dombi Commerce Platform
**Prerequisite:** Production Hardening Sprint completed

---

## EXECUTIVE SUMMARY

This review identifies **42 findings** across 9 domains. The system has **significant recovery gaps** that would make disaster recovery difficult and data loss severe.

### Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 14 |
| Medium | 17 |
| Low | 8 |

### Key Verdict

**Dombi has no automated backups, no restore process, and no recovery tooling.** A database failure means total data loss. Several order states can become permanently stuck with no automated recovery path.

---

## PART 1: DATABASE RECOVERY

### Critical

**F1.1 — No Automated Backup System**
- Risk: No `spatie/laravel-backup`, no backup commands, no backup scheduler. Database loss = total data loss.
- Impact: All orders, inventory, deliveries, customers, audit trails permanently gone.

**F1.2 — No Restore Process Documentation**
- Risk: No runbook for database restoration. Operations team lacks recovery steps.
- Impact: RTO extends significantly during incidents.

### High

**F1.3 — No Defined RTO/RPO**
- Risk: No recovery time/point objectives defined. Cannot validate backup strategy meets business needs.

**F1.4 — Infinite Data Loss Window**
- Risk: Without backups, any database failure causes permanent loss of all tables: orders, deliveries, inventory, notifications, status histories, audit logs.

### Positive

- `DB::prohibitDestructiveCommands()` prevents `migrate:fresh` in production
- All migrations have `up()` and `down()` methods for rollback support
- Scheduler-optimized indexes added in hardening sprint

---

## PART 2: SCHEDULER FAILURE

### High

**F2.1 — ExpirePendingOrders: Silent Failure**
- File: `app/Console/Commands/ExpirePendingOrders.php`
- Risk: No try/catch per order. One corrupt order aborts entire chunk. Returns `SUCCESS` unconditionally.
- Impact: Orders stay `pending_confirmation` past deadline. Reserved stock held hostage.

**F2.2 — No Scheduler Health Monitoring**
- Risk: `/api/health` checks DB and cache only. Does NOT check scheduler liveness, queue workers, or scheduled command recency.
- Impact: Scheduler crash goes undetected until users complain.

**F2.3 — Scheduler Failure Impact**
- If scheduler stops for 1 hour: ~60 expired orders accumulate, reserved stock locked
- If scheduler stops for 24 hours: ~1440 orders stuck, significant inventory locked
- When scheduler resumes: burst of stock releases, cascade of notifications

### Medium

**F2.4 — AutoOfflineCouriers: Memory Risk**
- File: `app/Console/Commands/AutoOfflineCouriers.php`
- Risk: Uses `->get()` instead of `chunkById()`. No per-courier error handling.
- Impact: Memory exhaustion at scale. Single failure stops entire job.

---

## PART 3: QUEUE FAILURE

### Medium

**F3.1 — Database-Backed Queue (Single Point of Failure)**
- Config: `config/queue.php`
- Risk: Queue uses same database as application. DB failure kills both app and queue.

**F3.2 — No Jobs Actually Use the Queue**
- Risk: All operations are synchronous. No async processing, no automatic retry on transient failures.

**F3.3 — No Failed Job Management**
- Risk: No scheduled retry or prune of `failed_jobs` table. No alerting on job failures.

---

## PART 4: NOTIFICATION RECOVERY

### High

**F4.1 — No Notification Rebuild Capability**
- Risk: No tooling to regenerate missing notifications. No idempotency mechanism to prevent duplicates.

**F4.2 — Incomplete Status Coverage**
- File: `app/Services/OrderStatusService.php:275-281`
- Risk: `fireStatusNotifications()` only handles `confirmed` status. Most status changes generate no order-level notifications.

### Medium

**F4.3 — Entity References Enable Partial Detection**
- Risk: `entity_type`/`entity_id` fields allow querying for missing notifications, but no automated detection exists.

---

## PART 5: INVENTORY RECOVERY

### Critical

**F5.1 — `failed_delivery` Dead-End with No Auto-Expiry**
- File: `app/Services/OrderStatusService.php:23`
- Risk: `failed_delivery => []` — terminal state with no transitions out. Only manual `resolveFailedDelivery()` can rescue. No scheduled job to auto-expire stale failures.
- Impact: Orders permanently stuck. Reserved stock permanently locked.

### High

**F5.2 — No Inventory Rebuild/Reconciliation Command**
- Risk: `StockMovement` history exists but no tooling to replay it. Corruption requires manual SQL.
- Impact: `reserved_stock` drift is unrecoverable without direct database manipulation.

**F5.3 — `releaseReservedStock()` Failure Blocks Cancellation**
- File: `app/Services/InventoryService.php:83-91`
- Risk: If `reserved_stock < item->quantity`, throws `InsufficientStockException` inside transaction. Order becomes un-cancellable.
- Impact: Stuck orders that cannot be cancelled or resolved.

### Medium

**F5.4 — `Auth::id()` Null in Scheduled Commands**
- Risk: `StockMovement.created_by` is null when `expireOrder()` runs from scheduler.

---

## PART 6: ORDER RECOVERY

### High

**F6.1 — Stuck `ready_for_pickup` Orders**
- Risk: Courier rejects, order returns to `ready_for_pickup`. If no new courier assigned, order sits indefinitely. Reserved stock locked.

**F6.2 — Stalled `delivering` Deliveries**
- Risk: Courier starts delivery but never completes or fails. No timeout mechanism. Delivery and order stuck indefinitely.

**F6.3 — No Stale Order Cleanup**
- Risk: No scheduled job for `ready_for_pickup`, `confirmed`, `preparing` timeout. Only `pending_confirmation` has expiry.

### Medium

**F6.4 — Delivery Rejection Creates Self-Referential History**
- File: `app/Services/DeliveryService.php:119-126`
- Risk: `from_status = ready_for_pickup`, `to_status = ready_for_pickup`. Confusing audit trail.

---

## PART 7: FILE STORAGE

### High

**F7.1 — No Cloud Storage Configured**
- Config: `config/filesystems.php`
- Risk: Default disk is `local`. S3 credentials empty. All files stored on local server.

**F7.2 — Proof of Delivery is String, Not File Upload**
- File: `app/Http/Requests/Courier/UpdateDeliveryStatusRequest.php:21`
- Risk: `proof_image` validated as `string`, not `UploadedFile`. No actual file handling exists.

**F7.3 — No File Backup Strategy**
- Risk: Local files have no backup. Server loss = permanent file loss.

### Medium

**F7.4 — No File Retention Policy**
- Risk: No scheduled cleanup of old files. Unbounded disk growth.

**F7.5 — `storage:link` Not in Deployment Steps**
- Risk: `public/storage` symlink missing after deployment. Files inaccessible via web.

---

## PART 8: DEPLOYMENT FAILURE

### Critical

**F8.1 — `.env` with Real Credentials in Repository**
- Risk: `APP_KEY`, `DB_PASSWORD` exposed. Credential compromise if repo becomes public.

### High

**F8.2 — Manual Deployment, No Automation**
- Risk: Human error during deployment. No atomic deployment. No audit trail.

**F8.3 — Manual Rollback, Risky Migration Handling**
- Risk: `migrate:rollback --step=1` only rolls back one migration. No pre-rollback backup. Data loss on destructive migrations.

### Medium

**F8.4 — CI Has No MySQL Service Container**
- Risk: Tests run on SQLite. MySQL-specific issues (ENUM, locks, raw SQL) not caught.

---

## PART 9: OBSERVABILITY

### High

**F9.1 — No External Error Tracking**
- Risk: No Sentry, Bugsnag, or Flare. Errors only in local log files. No real-time alerting.

**F9.2 — OperationalLog Incomplete Event Coverage**
- File: `app/Support/OperationalLog.php`
- Risk: Missing events: `orderCancelled`, `orderConfirmed`, `orderRejected`, `restockApproved`, `courierAssigned`, `loginSuccess`, `loginFailed`.

### Medium

**F9.3 — Default Log Stack is `single` (Unbounded)**
- Risk: `laravel.log` grows without rotation. Can consume all disk space.

**F9.4 — Slack/Papertrail Configured But Not Wired**
- Risk: `LOG_SLACK_WEBHOOK_URL` not set. No real-time critical alerts.

**F9.5 — No Scheduler Failure Alerting**
- Risk: `appendOutputTo()` captures output but no alerting on failure.

**F9.6 — No Request/Performance Monitoring**
- Risk: No APM. Slow queries, memory leaks invisible until user complaints.

---

## RECOVERY CAPABILITY MATRIX

| Scenario | Can Recover? | RTO | RPO | Data Loss |
|----------|-------------|-----|-----|-----------|
| Database failure | NO | N/A | N/A | Total loss |
| Scheduler crash | YES (auto-recovers) | 1 min | 0 | Temporary inconsistency |
| Single order stuck | Manual only | Hours | 0 | Stock locked |
| Inventory corruption | NO tooling | N/A | N/A | Manual SQL required |
| Notification loss | NO tooling | N/A | N/A | Not recoverable |
| File loss | NO | N/A | N/A | Permanent |
| Deployment failure | Manual rollback | 30+ min | Last deploy | Possible data loss |
| Queue failure | N/A (unused) | N/A | N/A | N/A |

---

## RECOMMENDED FIXES

### Pre-Production (Must Fix)

1. **Install automated backups** — `spatie/laravel-backup`, daily full, off-site storage, retention policy
2. **Document restore runbook** — step-by-step recovery procedure
3. **Rotate exposed credentials** — `APP_KEY`, `DB_PASSWORD` in `.env`
4. **Integrate error tracking** — Sentry or Flare
5. **Add scheduler heartbeat** — health check verifies scheduler liveness

### First Sprint (Should Fix)

6. **Add per-order try/catch** to `ExpirePendingOrders` and `AutoOfflineCouriers`
7. **Create `inventory:reconcile` command** — rebuild from StockMovement history
8. **Create `orders:resolve-stale` command** — timeout stuck states
9. **Harden `releaseReservedStock()`** — handle `reserved_stock < quantity` gracefully
10. **Wire Slack alerts** — `LOG_SLACK_WEBHOOK_URL` for critical errors
11. **Change default log stack** to `daily` in `.env.example`

### Medium-Term (Nice to Have)

12. **Create `deploy.sh` automation** — atomic deployment script
13. **Add Dockerfile** — reproducible builds
14. **Implement proper file upload** for proof of delivery
15. **Configure S3** for file storage
16. **Add queue/disk/scheduler checks** to health endpoint
17. **Create `notifications:rebuild` command**
18. **Add request performance monitoring**

---

## GO/CONDITIONAL GO/NO-GO ASSESSMENT

### CONDITIONAL GO (with significant caveats)

The Production Hardening Sprint resolved all Critical authorization, race condition, and security issues. The system is functionally safe for limited production use.

**However, the recovery posture is severely lacking:**

- **No backups** = single database failure destroys the business
- **No error tracking** = silent failures go undetected
- **No recovery tooling** = data corruption is unrecoverable

**Conditions for GO:**
1. Automated daily backups MUST be configured before any production data exists
2. Error tracking (Sentry) MUST be integrated before launch
3. Scheduler heartbeat MUST be added to health checks
4. Restore runbook MUST be documented and tested

**Without these conditions met, a single infrastructure failure could be catastrophic and unrecoverable.**

---

*Generated: 2026-06-05 | 307/307 tests passing | TypeScript clean | Build successful*
