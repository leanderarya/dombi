# Delivery Launch Smoke Test

**Release commit:**
**Environment:** staging
**Operator:**
**Started/finished:**

| Journey | Order | Expected | Result | Evidence |
|---|---|---|---|---|
| Address outside radius | — | Rejected before payment |  |  |
| Dombi courier success |  | Paid → completed |  |  |
| External courier success |  | Paid → completed |  |  |
| External courier failure |  | Failed with reason |  |  |
| Pending payment dispatch |  | Assignment rejected |  |  |
| Cross-outlet assignment |  | Authorization rejected |  |  |

## Reconciliation

- Customer paid amount:
- Customer delivery fee:
- External actual courier cost:
- Order status:
- Delivery status:
- Stock before/after:
- Unexpected failed jobs/log errors:
