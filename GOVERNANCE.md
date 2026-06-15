# Protocol Governance

This document defines how the Agent Civilization Architecture protocol itself is governed.

A protocol about governance must practice what it preaches.

## Decision Authority

**Makito Chiba** is the current protocol author and maintainer (Chair).

During the v0.x phase, the Chair has final authority over specification changes. This is intentional: premature committee governance produces design-by-committee protocols. A clear authorial voice is needed until the specification stabilizes.

At v1.0, a formal governance transition plan will be published.

## Specification Changes

### Layer 1-3 (Core)

Changes to Layers 1-3 (Memory, Trust, Identity) after v1.0 freeze require:

1. A written proposal with Assumptions, Evidence, Risks, Trade-offs, and Rollback Plan
2. At least one public dissent or challenge (if none is offered, the proposer must write a self-challenge)
3. A review period of at least 14 days
4. Chair ratification

### Layer 4-6 (Extensions)

Extension RFCs (Authority, Decision, Constitution) follow the same process but with a 7-day review period during the draft phase.

### Breaking Changes

Any change that would make a previously conformant implementation non-conformant requires:

1. A migration path documented in the proposal
2. A deprecation period of at least one major version
3. Explicit Chair ratification with recorded reasoning

## Conformance

A conformance test suite will be published alongside the v1.0 specification. An implementation is "ACA-conformant at Layer N" if it passes all conformance tests for Layers 1 through N.

The conformance suite is the canonical definition of the protocol. Where the prose specification and the conformance tests disagree, the tests are authoritative.

## Contributions

Contributions are welcome via GitHub Issues and Pull Requests. By contributing, you agree that your contributions are licensed under Apache 2.0.

Priority areas for contribution:
- Conformance test cases
- Alternative language implementations (Python, Rust, Go)
- Layer 4-6 design proposals
- Real-world deployment experience reports
