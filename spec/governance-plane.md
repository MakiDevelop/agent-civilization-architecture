# Governance Plane: Constitution — Protocol Specification

**Status**: Draft v0.1 — June 2026

**Civilizational analog**: Constitutional law, amendment process, judicial interpretation

**Core question**: How do the rules evolve?

---

## 1. Overview

The Governance Plane is the meta-layer of ACA — the rules about rules. It does not sit "above" the operational layers (1-5); it **constrains all of them**. It defines how governance rules are created, modified, and retired, ensuring that no single agent can unilaterally rewrite the system that governs it.

Every civilization faces the meta-governance problem: who watches the watchmen? A constitution without an amendment process is rigid until it breaks. A constitution without limits on amendment is fragile until it's captured. The Governance Plane balances these tensions.

**Design principle**: Governance changes are the highest-risk decisions. They receive the strictest scrutiny: mandatory `critical` risk classification (Layer 5), mandatory Independent Review (Layer 4), and mandatory quorum for structural changes.

**Relationship to Layers 1-5**: The Governance Plane operates *on* the other layers:
- It uses Layer 1 (Memory) to store governance records
- It uses Layer 2 (Trust) to verify governance evidence
- It uses Layer 3 (Identity) to authenticate governance actors
- It uses Layer 4 (Authority) to enforce who can propose/ratify changes
- It uses Layer 5 (Decision) as the mechanism for governance changes

The Governance Plane does not introduce new operational primitives. It defines **policies** that constrain how existing primitives are used.

---

## 2. Data Model

### 2.1 GovernanceRule

A GovernanceRule is a named, versioned policy that constrains organizational behavior.

```json
{
  "rule_id": "string (unique identifier, e.g. 'anti-ouroboros', 'namespace-isolation')",
  "version": "integer (monotonically increasing)",
  "status": "active | suspended | archived",
  "category": "immutable | structural | operational",
  "title": "string",
  "specification": "string (the rule text, in normative language)",
  "enforced_at_layers": [1, 2, 3, 4, 5],
  "created_at": "string (ISO 8601)",
  "created_by_decision": "string (decision_id that established this rule)",
  "supersedes_version": "integer | null"
}
```

### 2.2 Rule Categories

Rules are classified by how difficult they are to change:

| Category | Definition | Amendment Process |
|---|---|---|
| `immutable` | Cannot be changed or suspended. Period. | No amendment process — these are axioms. |
| `structural` | Can be changed through a formal amendment with quorum + Independent Review | Layer 5 `critical` decision + quorum of principals with `modify_governance` capability |
| `operational` | Can be changed through normal governance decision process | Layer 5 `high` decision with `modify_governance` capability |

### 2.3 Immutable Rules

The following rules are **immutable** — they cannot be modified, suspended, or removed by any mechanism:

1. **Mandatory Audit**: Every state-changing operation produces an AuditEvent. There is no silent mode.
2. **Anti-Ouroboros Core**: `llm_derived` MemoryCells MUST NOT autonomously supersede `llm_derived` MemoryCells. The specific enforcement mechanism may be refined, but the invariant cannot be removed.
3. **Append-only Audit**: Audit logs cannot be modified or deleted.
4. **Human Accountability**: The deadlock resolution authority MUST be traceable to an accountable entity (human or human-authorized).

**Why immutable rules exist**: Without them, a sufficiently capable agent could propose amending away the audit trail, then operate without oversight. Immutable rules are the protocol's equivalent of unamendable constitutional clauses (e.g., Article 79(3) of the German Basic Law).

### 2.4 Knowledge Promotion

The lifecycle by which individual agent knowledge becomes organizational canon:

```
candidate → accepted → canonical → archived | expired
```

| Status | Meaning | Promotion Trigger |
|---|---|---|
| `candidate` | Freshly written, unverified | Default for new MemoryCells |
| `accepted` | Passed trust verification; referenceable by team | `human_confirmed` tier upgrade (Layer 2) |
| `canonical` | Organizational knowledge — settled policy | Governance decision (Layer 5 `high`+) ratifying the knowledge |
| `archived` | Superseded canonical knowledge; retained for audit | Superseded by newer canonical knowledge |
| `expired` | Past validity; no longer authoritative | `valid_until` passed or explicit expiration |

**Not every memory should be promoted.** Most memories remain `candidate` and eventually expire. Promotion to `canonical` is a governance act, not an automatic process.

### 2.5 GovernanceAmendment

An amendment to a governance rule is a structured proposal to change an existing rule.

```json
{
  "amendment_id": "string",
  "target_rule_id": "string",
  "target_version": "integer (current version being amended)",
  "proposed_specification": "string (new rule text)",
  "rationale": "string",
  "impact_analysis": {
    "affected_layers": [1, 2, 3, 4, 5],
    "affected_roles": ["string"],
    "backward_compatible": "boolean",
    "migration_required": "boolean",
    "migration_plan": "string | null"
  },
  "decision_id": "string (Layer 5 decision governing this amendment)"
}
```

---

## 3. Operations

### 3.1 Propose Amendment

Proposes a change to a governance rule.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `target_rule_id`, `proposed_specification`, `rationale`, `impact_analysis` |
| **Pre-conditions** | Caller has `modify_governance` capability (Layer 4). Target rule exists and is NOT `immutable`. Impact analysis is complete. |
| **Processing** | 1. Reject if target rule is `immutable`. 2. Create a Layer 5 Decision with risk level `critical` (for `structural` rules) or `high` (for `operational` rules). 3. Attach GovernanceAmendment to the decision. 4. Append AuditEvent. |
| **Output** | `{ amendment_id, decision_id, risk_level }` |

### 3.2 Ratify Amendment

Approves a governance amendment. This is a Layer 5 ratification with additional governance-specific constraints.

**Contract**:

| Aspect | Specification |
|---|---|
| **Pre-conditions** | Layer 5 ratification pre-conditions PLUS: for `structural` rules, quorum approval from principals with `modify_governance` (configurable, default: majority). Break-glass MUST NOT be used for governance changes. |
| **Processing** | 1. Validate quorum (for `structural`). 2. Create new GovernanceRule version. 3. Set old version to `archived`. 4. Update Layer 5 decision to `ratified`. 5. Append AuditEvent with full before/after diff. |
| **Output** | `{ rule_id, new_version, decision_id }` |

### 3.3 Suspend Rule

Temporarily disables a governance rule.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `rule_id`, `reason`, `resume_at` (optional deadline) |
| **Pre-conditions** | Rule is NOT `immutable`. Caller has `modify_governance`. Suspension requires a Layer 5 `high` decision. |
| **Processing** | 1. Set rule status to `suspended`. 2. If `resume_at` is set, schedule auto-resume. 3. Append AuditEvent. |
| **Output** | `{ rule_id, status: "suspended", resume_at }` |

### 3.4 Governance Health Check

Detects governance decay — rules that are never invoked, roles that are never exercised, and trust policies that are never tested.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `time_window` (e.g., "30d", "90d") |
| **Processing** | 1. Scan AuditEvents within window. 2. Identify governance rules with zero related events. 3. Identify roles with zero active assignments or zero `checkAuthority` calls. 4. Identify namespaces with zero writes. |
| **Output** | `{ dormant_rules: [], unexercised_roles: [], inactive_namespaces[] }` |

This is advisory, not enforceable. Implementations SHOULD run periodic health checks and surface results to principals with `modify_governance` capability.

---

## 4. Governance Invariants

These invariants MUST hold at all times:

### 4.1 Amendment Cycle Protection

A governance amendment MUST NOT be used to weaken the amendment process itself. Specifically:
- An amendment to the quorum requirement MUST itself pass the *current* quorum (not the proposed lower one).
- An amendment to `modify_governance` capability requirements MUST be approved by principals who currently hold the capability.

### 4.2 Immutability Enforcement

No operation — including break-glass, direct database access, or runtime configuration — may disable or modify an immutable rule. Implementations MUST enforce immutability at the code level, not the policy level.

### 4.3 Audit Completeness

Every governance operation (propose, ratify, suspend, resume, health check) produces AuditEvents. The audit trail for governance operations is itself governed by the immutable Mandatory Audit rule — creating an unforgeable chain.

---

## 5. Integration with Layers

### 5.1 Layer 1 (Memory)
- GovernanceRules are stored as MemoryCells with `memory_type: constraint` and `source.tier: human_confirmed`.
- Knowledge Promotion (§2.4) uses Layer 1 MemoryCell lifecycle + Layer 2 tier upgrade.

### 5.2 Layer 2 (Trust)
- Anti-Ouroboros is an immutable governance rule. Its enforcement at Layer 2 cannot be disabled.
- GovernanceAmendment evidence must include `human_confirmed` MemoryCells (inherits from Layer 5 `critical` evidence requirements).

### 5.3 Layer 3 (Identity)
- `modify_governance` principals must be registered and active.
- For `structural` amendments, principal independence is verified (no single-vendor quorum).

### 5.4 Layer 4 (Authority)
- `modify_governance` capability gates all governance operations.
- Break-glass explicitly excluded from governance changes (§3.2).

### 5.5 Layer 5 (Decision)
- Every governance change is a Layer 5 Decision with elevated risk classification.
- `structural` rules → `critical` decision.
- `operational` rules → `high` decision.

### 5.6 Backward Compatibility

The Governance Plane is OPTIONAL. When not implemented:
- Governance rules are implicit in the implementation code.
- There is no formal amendment process — changes are code changes.
- Immutable rules are still enforced at the code level (Anti-Ouroboros, Mandatory Audit).

---

## 6. Conformance

An implementation is **ACA Governance Plane conformant** if it:

1. Implements the GovernanceRule data model with the three categories (immutable, structural, operational).
2. Enforces immutability of the four immutable rules (§2.3) at the code level.
3. Routes governance amendments through Layer 5 Decision with appropriate risk classification.
4. Enforces quorum for `structural` rule amendments.
5. Implements amendment cycle protection (§4.1).
6. Excludes break-glass from governance changes.
7. Maintains audit trail for all governance operations.
8. Passes the Governance Plane conformance test suite (forthcoming).

**Note**: Governance Plane conformance requires Layer 1+2+3+4+5 conformance. The layers are cumulative.

---

## References

- Hart, H.L.A. (1961), "The Concept of Law" — primary and secondary rules; rules about rules
- Ostrom, E. (1990), "Governing the Commons" — self-governing institutions with constitutional-level rules
- Elster, J. (2000), "Ulysses Unbound" — pre-commitment devices and constitutional self-binding
- German Basic Law, Article 79(3) — the "eternity clause" preventing amendment of fundamental principles
- EU AI Act (2024), Articles 9, 12, 13, 14 — risk management, record-keeping, transparency, human oversight
- COINE Workshop Series — institutions and norms for MAS: https://coin-workshop.github.io/
- Agent Memory Hall v0.8 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
