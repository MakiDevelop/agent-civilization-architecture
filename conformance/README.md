# ACA Conformance Test Suite

Tests that verify whether an implementation conforms to the Agent Civilization Architecture protocol specification.

## Conformance Levels

| Level | Requirements | Gates |
|---|---|---|
| **Layer 1** | 8 operations + dedup + namespace isolation + lifecycle filter + audit integrity | L1 gates only |
| **Layer 1+2** | All Layer 1 requirements + Anti-Ouroboros + tier transitions + provenance chain | L1 + L2 gates |

## Running Tests

Tests are written in TypeScript using Node.js built-in test runner. They test against the **protocol contract**, not implementation internals.

```bash
# Test against the reference implementation (Agent Memory Hall)
npm test

# Test against a custom implementation via MCP
ACA_MCP_COMMAND="your-implementation serve" npm test
```

## Test Structure

```
conformance/
├── README.md
├── layer1/
│   ├── write.test.ts        — Write contract + rejected audit
│   ├── read.test.ts         — Lifecycle filter + pagination
│   ├── supersede.test.ts    — Atomicity + concurrent supersede
│   ├── revoke.test.ts       — Idempotency + status transitions
│   ├── tier-upgrade.test.ts — Upward-only + dedup exemption
│   ├── transfer.test.ts     — Tier preservation + cross-ns
│   ├── expire.test.ts       — Explicit + lazy expiration
│   ├── audit.test.ts        — Append-only + correlation_id
│   └── dedup.test.ts        — BLAKE3 content_hash + format:value
└── layer2/
    ├── anti-ouroboros.test.ts — All 9 tier combinations
    ├── tier-transitions.test.ts — Monotonic non-decreasing
    ├── trust-proof.test.ts   — Required on upgrade
    ├── provenance-chain.test.ts — Append-only on transfer/supersede
    └── consumer.test.ts      — Fail-closed default
```

## Writing Tests for Your Implementation

Each test file exports a standard interface. To test your own implementation:

1. Implement the `AcaTestAdapter` interface (provides write/read/supersede/etc.)
2. Point the test runner at your adapter
3. All tests run against the adapter, not directly against AMH

This ensures the tests verify **protocol conformance**, not AMH-specific behavior.
