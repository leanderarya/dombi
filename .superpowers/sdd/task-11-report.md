# Task 11 Report

## Scope
- Finance ordering uses selected obligation requested timestamp; selected obligation resolution is deterministic and cached per payload/order.
- Refund payload started timestamp uses canonical datetime cast and safe `toISOString`; canonical destination/proof/transfer remain one selected obligation source.
- RefundService canonical lifecycle continues binding selected non-synthetic attempt/reason and projects transition timestamps to Order.
- Synthetic legacy attempts excluded from canonical lifecycle.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
