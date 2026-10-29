# V1 cutover owner decisions

Recorded 29 October 2026 for the approved release candidate
`750190e3f6cf82a8295995c18c49990e15c5cac0`.

This decision note supersedes earlier V1 checklist language that made historical
OLD financial reconciliation or an isolated OLD restore drill mandatory for Go-Live.
It records scope decisions; it does not authorize production changes or Go-Live.

## Accepted residual risks and preservation duties

- **Historical OLD financial records:** reconciliation is waived for V1 as an explicit
  residual risk. The records remain unresolved. Do not describe them as reconciled or
  paid, and do not delete, rewrite, or migrate them. Preserve OLD records and their
  evidence for later recovery.
- **Isolated OLD restore drill:** waived as an explicit residual risk. No restore test is
  claimed. A fresh, verified OLD backup remains required before cutover, including the
  OLD database, code, private configuration/key material, uploads, and untracked files.
  Keep the backup private and preserve OLD unchanged for rollback.
- **Independent callback infrastructure:** a separate callback platform is not required
  for V1. The minimum callback-isolation check below remains pending and is not waived.

## Minimum callback isolation — pending

The existing signed DOKU notify ingress validates the request and deduplicates matching
request IDs/body digests. If an invoice has no canonical payment attempt, processing fails
retryably and returns HTTP 500; it is not marked processed as a success and does not
transition a payment attempt. This existing fail-closed behavior is the preferred V1 base;
no independent receiver/spool platform is part of this release.

Before reopening traffic, verify the callback path uses the approved NEW release and
database, OLD payment creation is frozen, and the complete frozen OLD invoice set cannot
resolve to a NEW payment attempt. Current payment processing resolves by invoice number;
the no-match safeguard alone does not distinguish an OLD invoice if an exact matching NEW
attempt exists. If an exact overlap is found, or ownership cannot be proven, keep the
payment callback/payment flow closed until a narrowly scoped OLD-invoice rejection is
approved and verified, or the Owner explicitly accepts that collision risk. Do not treat
this risk as silently waived. Do not change the DOKU endpoint or replay callbacks as part
of this decision.

## Deployment and final-release gates

- At the 29 October 2026 review, GitHub API reported the legacy `Deploy Production`
  workflow as `disabled_manually`, with zero queued, pending, waiting, or in-progress runs.
  Keep it disabled through the controlled cutover. The replacement workflow in this PR
  performs quality validation and asset packaging only; it has no production deployment.
- After PR merge, record the resulting `main` SHA and verify the newly produced artifact's
  embedded release SHA and all file checksums against that exact `main` SHA before any
  production use. The current PR artifact is tied to a synthetic merge SHA and is not the
  final post-merge artifact.
- Before cutover, separately verify Hostinger's actual document root and the effective
  NEW database identity and database session handler. These were not established by this
  documentation update.

Passing PR checks and merging this preparation release do not authorize deployment,
migration, Owner changes, traffic switching, DOKU operations, or Go-Live.
