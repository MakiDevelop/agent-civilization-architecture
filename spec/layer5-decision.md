# Layer 5: Decision — Protocol Specification

**Status**: Draft v0.2 — June 2026

**Civilizational analog**: Legislative process, executive orders, judicial review

**Core question**: How does the organization decide?

---

## 1. Overview

The Decision Layer structures the lifecycle of organizational decisions — from proposal through deliberation, review, ratification, implementation, and eventual supersession or revocation. It is the highest operational layer in ACA, sitting above Authority (Layer 4) which determines *who may decide*, while this layer determines *how decisions are made*.

A decision is NOT a memory. It is a **state machine** that spans multiple MemoryCells. A decision references evidence (memories), generates new knowledge (memories), and modifies the organization's behavior. The Decision Layer *operates on* memories, not *within* them.

**Design principle**: Every decision produces an auditable record of what was proposed, what evidence was considered, who reviewed, who dissented, who ratified, and what the implementation plan is. Decisions without this record are not decisions — they are actions.

**Relationship to Layer 4**: Layer 4 defines the capability gates (`propose_decision`, `ratify_decision`, `veto_decision`) and the Independent Review mechanism (Layer 4 §2.7). Layer 5 defines the state machine that these capabilities operate on, and the `critical` classification that triggers mandatory review. Independent Review Records (Layer 4) are embedded in the Decision lifecycle at the `under_review` stage.

---

## 2. Data Model

### 2.1 Decision

A Decision is the atomic unit of organizational governance action.

```json
{
  "decision_id": "string (UUID v4)",
  "title": "string (concise description)",
  "status": "proposed | under_review | ratified | in_effect | superseded | revoked",
  "risk_level": "low | medium | high | critical",

  "proposer_principal_id": "string (Layer 3 principal who proposed)",
  "proposer_role_id": "string (Layer 4 role acting as)",

  "proposal": {
    "assumptions": ["string (what we believe to be true)"],
    "evidence_ids": ["string (memory_ids supporting the proposal)"],
    "risks": ["string (what could go wrong)"],
    "trade_offs": ["string (what we are giving up)"],
    "rollback_plan": "string (how to undo if wrong)",
    "implementation_steps": ["string (ordered steps to execute)"]
  },

  "reviews": ["IndependentReviewRecord (Layer 4 §2.7)"],
  "escalations": ["EscalationRecord"],
  "ratification": "RatificationRecord | null",

  "created_at": "string (ISO 8601)",
  "effective_at": "string | null (ISO 8601, when decision takes effect)",
  "review_deadline": "string | null (ISO 8601, after which unresolved decision is revoked)",
  "review_by": "string | null (ISO 8601, mandatory re-evaluation date for in_effect decisions)",
  "supersedes": "string | null (decision_id this replaces)",
  "superseded_by": "string | null (decision_id that replaced this)"
}
```

**Storage**: Decisions are stored in a DecisionStore (analogous to AmhStore for Layer 1). Implementations MAY use the same backing database but MUST maintain separate logical collections. Decisions are NOT MemoryCells and MUST NOT be stored in the memories table.

### 2.2 Risk Classification

Every decision MUST be classified by risk level. The classification determines which governance mechanisms apply:

| Risk Level | Definition | Review | Ratification | Evidence |
|---|---|---|---|---|
| `low` | Reversible, single-scope, no external effect | Optional | Self-ratify allowed (skip `under_review`, direct `proposed→ratified`) unless `cannot_self_approve` constraint applies | No formal requirement |
| `medium` | Reversible but cross-scope, or external side effects | Recommended | Different principal than proposer | ≥1 active MemoryCell |
| `high` | Difficult to reverse, or multi-namespace | Required: ≥1 Independent Review | Different principal than proposer; reviewer ≠ ratifier | ≥1 `human_confirmed` or `raw_source` MemoryCell |
| `critical` | Irreversible, governance change, or production | Required: ≥1 Independent Review with substance + addressal | Different principal than proposer; reviewer ≠ ratifier; reviewer ≠ proposer | ≥1 `human_confirmed` MemoryCell; `llm_derived`-only is **blocked** |

**`low` self-ratify shortcut**: For `low` decisions, the proposer MAY ratify immediately (`proposed → ratified`), skipping `under_review`. This shortcut is blocked if the proposer's role carries the `cannot_self_approve` constraint (Layer 4).

**Auto-classification**: Decisions that match Layer 4 escalation triggers are automatically classified:
- `governance_modification` → `critical`
- `irreversible_action` → `critical`
- `risk_exceeds_threshold` → at least `high`
- `multi_role_disagreement` → at least `medium`

Auto-classification MAY upgrade but MUST NOT downgrade the proposer's classification.

### 2.3 Decision Lifecycle

```
         propose
  ────────────────► proposed
                       │
              ┌────────┤
              │        │
        (low: self-  review
         ratify)       │
              │        ▼
              │   under_review ──── timeout ──► revoked
              │        │
              │   ┌────┼────┐
              │   │         │
              │ ratify    veto
              │   │         │
              ▼   ▼         ▼
           ratified      revoked
              │
         implement
              │
              ▼
          in_effect ──── review_by date ──► (re-evaluate: supersede or renew)
              │
         ┌────┴────┐
         │         │
     supersede   revoke
         │         │
         ▼         ▼
    superseded   revoked
```

**Status definitions**:

| Status | Meaning |
|---|---|
| `proposed` | Submitted, awaiting review or self-ratification |
| `under_review` | At least one reviewer or escalation is active |
| `ratified` | Approved by authorized principal; not yet executed |
| `in_effect` | Implementation complete; decision is active policy |
| `superseded` | Replaced by a newer decision |
| `revoked` | Explicitly invalidated (by veto, timeout, or explicit revocation) |

**Invariants**:
- Status transitions are forward-only (no reversion to `proposed` from `under_review`).
- A vetoed decision transitions directly to `revoked` with `details: "vetoed"`.
- `ratified` → `in_effect` requires confirmation that implementation steps are complete.
- Timeout: a decision in `under_review` past its `review_deadline` transitions to `revoked` with `details: "review_timeout"`.
- `review_by` on `in_effect` decisions is advisory. Implementations SHOULD trigger re-evaluation (propose superseding decision or renew with new evidence).

### 2.4 RatificationRecord

```json
{
  "ratified_by": "string (principal_id)",
  "ratified_role": "string (role_id, must have ratify_decision capability)",
  "ratified_at": "string (ISO 8601)",
  "rationale": "string (why this decision was approved)",
  "review_addressal": "string | null (how independent review concerns were addressed; MUST be non-null for critical)",
  "conditions": ["string (any conditions attached to ratification)"]
}
```

**Invariants**:
- `ratified_by` MUST NOT equal `proposer_principal_id` for `medium`+ decisions.
- For `high`/`critical` decisions, `ratified_by` MUST NOT be the sole reviewer (reviewer ≠ ratifier).
- For `critical` decisions, `review_addressal` MUST reference each Independent Review Record and explain how concerns were mitigated or accepted as risk.

### 2.5 EscalationRecord

```json
{
  "escalation_id": "string",
  "escalated_by": "string (principal_id)",
  "escalated_at": "string (ISO 8601)",
  "reason": "string",
  "trigger": "string (EscalationCondition from Layer 4 §2.6)",
  "target_role": "string",
  "resolution": "string | null (how escalation was resolved)",
  "resolved_at": "string | null"
}
```

---

## 3. Operations

### 3.1 Propose Decision

Submits a new decision for organizational consideration.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `title`, `risk_level`, `proposal` (assumptions, evidence_ids, risks, trade_offs, rollback_plan, implementation_steps) |
| **Pre-conditions** | Caller has `propose_decision` capability (Layer 4). All `evidence_ids` reference existing, active MemoryCells (expired/revoked evidence is rejected). |
| **Processing** | 1. Validate evidence exists and is active. 2. Auto-classify risk level (may upgrade, never downgrade). 3. Run Anti-Ouroboros evidence check (§4.3). 4. Create Decision record with `status: proposed`. 5. Append AuditEvent with `correlation_id` linking to `decision_id`. |
| **Output** | `{ decision_id, status: "proposed", risk_level }` |

### 3.2 Review Decision

Triggers transition to `under_review` and collects Independent Reviews.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id` |
| **Pre-conditions** | Decision is in `proposed` status. Risk level is `medium` or above (low decisions skip review). |
| **Processing** | 1. Set status to `under_review`. 2. Notify eligible reviewers. 3. Set `review_deadline` (configurable; RECOMMENDED defaults: 24h for `critical`, 4h for `high`, 1h for `medium`). 4. Append AuditEvent. |
| **Output** | `{ decision_id, status: "under_review", review_deadline }` |

### 3.3 Ratify Decision

Approves a decision after review.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `rationale`, `review_addressal` (required for `critical`), `conditions[]` (optional) |
| **Pre-conditions** | Caller has `ratify_decision` capability. Decision is `proposed` (low self-ratify) or `under_review`. For `high`/`critical`: ≥1 Independent Review Record exists. For `critical`: review has substance per Layer 4 §2.7. For `medium`+: caller ≠ proposer. For `high`+: caller ≠ sole reviewer. Anti-Ouroboros gate passes (§4.3). |
| **Processing** | 1. Validate all pre-conditions. 2. Create RatificationRecord. 3. Set status to `ratified`. 4. Append AuditEvent. |
| **Output** | `{ decision_id, status: "ratified" }` |

### 3.4 Veto Decision

Blocks a decision.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `reason`, `evidence_ids[]` (optional) |
| **Pre-conditions** | Caller has `veto_decision` capability. Decision is `proposed` or `under_review`. |
| **Processing** | 1. Set status to `revoked`. 2. Record veto reason. 3. Append AuditEvent. |
| **Output** | `{ decision_id, status: "revoked", reason }` |

### 3.5 Implement Decision

Confirms that a ratified decision has been executed.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `implementation_notes` |
| **Pre-conditions** | Decision is `ratified`. Caller has appropriate capabilities for the implementation domain. |
| **Processing** | 1. Set status to `in_effect`. 2. Set `effective_at`. 3. Generate MemoryCells per §4.2. 4. Append AuditEvent with `correlation_id`. |
| **Output** | `{ decision_id, status: "in_effect", effective_at }` |

### 3.6 Supersede Decision

Replaces an active decision with a new one.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | New Decision proposal with `supersedes` pointing to the target `decision_id`. |
| **Pre-conditions** | Target decision is `in_effect`. New decision goes through the full lifecycle. |
| **Processing** | 1. On ratification of new decision: set target's status to `superseded`, set target's `superseded_by`. 2. Append AuditEvent for both with shared `correlation_id`. |
| **Output** | `{ new_decision_id, superseded_decision_id }` |

### 3.7 Revoke Decision

Explicitly invalidates an active decision.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `reason` |
| **Pre-conditions** | Decision is `in_effect`. Caller has `veto_decision` capability or is deadlock resolver. |
| **Processing** | 1. Set status to `revoked`. 2. Append AuditEvent. |
| **Output** | `{ decision_id, status: "revoked" }` |

### 3.8 Query Decisions

Retrieves decisions by status, risk level, proposer, or date range.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | Filter: `status`, `risk_level`, `proposer_principal_id`, `effective_after`, `effective_before`, `limit` |
| **Output** | `{ decisions: Decision[], next_cursor: string | null }` |

---

## 4. Evidence and Memory Integration

### 4.1 Evidence Requirements

Decisions reference MemoryCells (Layer 1) as evidence. Evidence quality requirements vary by risk level (see §2.2 table). Additional rules:

- All `evidence_ids` MUST reference active MemoryCells. Expired, revoked, or superseded evidence is rejected at proposal time.
- Evidence MAY be added during `under_review` (reviewers may request additional evidence). Added evidence MUST be audited.
- For `critical` decisions, at least one evidence MemoryCell MUST be at `human_confirmed` tier. `raw_source` evidence is allowed alongside `human_confirmed` but is insufficient alone for `critical`.

### 4.2 Decision as Memory Generator

When a decision reaches `in_effect`, the implementation MUST (for `critical`) or SHOULD (for others) create MemoryCells to record:
- The decision rationale (as `fact` type, `human_confirmed` tier if ratified by human principal)
- Any constraints introduced by the decision (as `constraint` type)
- Lessons learned during review (as `lesson` type)

Generated MemoryCells MUST include `correlation_id` in their AuditEvent linking back to the `decision_id`.

### 4.3 Anti-Ouroboros Gate

The Anti-Ouroboros Rule (Layer 2 §3.1) protects against LLM-derived knowledge self-reinforcement. At the Decision Layer, this rule is **enforceable, not advisory**:

1. **At proposal time**: If all `evidence_ids` reference only `llm_derived` MemoryCells and risk level is `high` or `critical`, the risk level is auto-upgraded to `critical` and a warning is attached: `"evidence_all_llm_derived"`.
2. **At ratification time**: For `critical` decisions, ratification MUST be **blocked** if all evidence is `llm_derived`. The ratifier must either:
   - Add `human_confirmed` evidence, OR
   - Downgrade the decision to `high` with explicit acknowledgment of the llm-only evidence risk in `review_addressal`.
3. **Proposer self-evidence**: An agent MUST NOT be the sole evidence source for a decision it proposes. If `proposer_principal_id` authored all evidence MemoryCells (checked via `created_by`), the decision requires at least one piece of external evidence.

This gate closes the loop identified in Layer 2's threat model: preventing LLM agents from building self-reinforcing governance decisions on their own generated knowledge.

---

## 5. Integration with Other Layers

### 5.1 Layer 1 (Memory)
- `evidence_ids` reference MemoryCells. Evidence must be active at proposal time.
- Ratified decisions generate new MemoryCells (§4.2) with `correlation_id` linkage.
- Decision records are NOT MemoryCells — they have separate storage and lifecycle.

### 5.2 Layer 2 (Trust)
- Evidence tier requirements (§4.1) enforce trust quality in decision-making.
- Anti-Ouroboros gate (§4.3) is enforceable: blocks `critical` ratification on llm-only evidence.
- Proposer self-evidence check prevents single-agent closed-loop governance.

### 5.3 Layer 3 (Identity)
- `proposer_principal_id` and `ratified_by` must be valid, active Principals.
- Separation of duties enforced by principal identity comparison.

### 5.4 Layer 4 (Authority)
- `propose_decision`, `ratify_decision`, `veto_decision` capabilities gate all operations.
- Independent Review (Layer 4 §2.7) is embedded at `under_review` stage for `high`/`critical`.
- `critical` classification triggers Layer 4's mandatory review with independence + substance + addressal.
- Escalation triggers from Layer 4 auto-upgrade risk classification.

### 5.5 Backward Compatibility

Layer 5 is OPTIONAL. When not implemented:
- Organizational decisions are informal (no structured lifecycle).
- Layer 4 capabilities `propose_decision`, `ratify_decision`, `veto_decision` have no target state machine.
- Independent Review (Layer 4) can still function for non-decision operations.

---

## 6. Conformance

An implementation is **ACA Layer 5 conformant** if it:

1. Implements the Decision data model with the six-status lifecycle.
2. Enforces risk classification with auto-upgrade from escalation triggers.
3. Enforces separation of duties (proposer ≠ ratifier for `medium`+; reviewer ≠ ratifier for `high`+).
4. Enforces evidence tier requirements by risk level, including stale evidence rejection.
5. Enforces the Anti-Ouroboros gate at ratification (§4.3): blocks `critical` on llm-only evidence.
6. Enforces proposer self-evidence check (§4.3.3).
7. Integrates with Layer 4 Independent Review for `high`/`critical` decisions.
8. Implements decision timeout (`review_deadline` → `revoked`).
9. Generates MemoryCells on `in_effect` transition for `critical` decisions (MUST) with `correlation_id`.
10. Supports decision supersession with full lifecycle for the replacement.
11. Maintains audit trail for all decision operations with `correlation_id` linking to `decision_id`.
12. Passes the Layer 5 conformance test suite (forthcoming).

**Note**: Layer 5 conformance requires Layer 1+2+3+4 conformance. The layers are cumulative.

---

## References

- Simon, H. (1947), "Administrative Behavior" — bounded rationality in organizational decision-making
- Janis, I. (1972), "Victims of Groupthink" — groupthink failure modes; Layer 5's Independent Review + SoD are structural countermeasures
- Schwenk, C. (1984), "Devil's Advocacy in Managerial Decision-Making" — structured dissent; Independent Review operationalizes this
- Kahneman, D. (2011), "Thinking, Fast and Slow" — cognitive biases; risk classification forces deliberative review over intuitive fast-path
- COINE Workshop Series — norms and governance for MAS: https://coin-workshop.github.io/
- EU AI Act (2024), Articles 9, 14 — risk management systems and human oversight requirements
- Agent Memory Hall v0.8 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
