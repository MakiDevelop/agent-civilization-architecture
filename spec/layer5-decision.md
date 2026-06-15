# Layer 5: Decision — Protocol Specification

**Status**: Draft v0.1 — June 2026

**Civilizational analog**: Legislative process, executive orders, judicial review

**Core question**: How does the organization decide?

---

## 1. Overview

The Decision Layer structures the lifecycle of organizational decisions — from proposal through deliberation, review, ratification, implementation, and eventual supersession or revocation. It is the highest operational layer in ACA, sitting above Authority (Layer 4) which determines *who may decide*, while this layer determines *how decisions are made*.

A decision is NOT a memory. It is a **state machine** that spans multiple MemoryCells. A decision references evidence (memories), generates new knowledge (memories), and modifies the organization's behavior. The Decision Layer *operates on* memories, not *within* them.

**Design principle**: Every decision produces an auditable record of what was proposed, what evidence was considered, who reviewed, who dissented, who ratified, and what the implementation plan is. Decisions without this record are not decisions — they are actions.

**Relationship to Layer 4**: Layer 4 defines the capability gates (`propose_decision`, `ratify_decision`, `veto_decision`) and the Independent Review mechanism. Layer 5 defines the state machine that these capabilities operate on, and the `critical` classification that triggers mandatory review.

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
  "review_by": "string | null (ISO 8601, mandatory re-evaluation date)",
  "supersedes": "string | null (decision_id this replaces)",
  "superseded_by": "string | null (decision_id that replaced this)"
}
```

### 2.2 Risk Classification

Every decision MUST be classified by risk level. The classification determines which governance mechanisms apply:

| Risk Level | Definition | Requirements |
|---|---|---|
| `low` | Reversible, single-scope, no external effect | Proposer may self-ratify (if no `cannot_self_approve` constraint) |
| `medium` | Reversible but cross-scope, or has external side effects | Requires ratification by a principal other than proposer |
| `high` | Difficult to reverse, or affects multiple namespaces/teams | Requires ratification + at least one Independent Review |
| `critical` | Irreversible, modifies governance, or affects production systems | Requires ratification + Independent Review with substance + addressal (Layer 4 §2.7) |

**Auto-classification**: Decisions that match Layer 4 escalation triggers are automatically classified:
- `governance_modification` → `critical`
- `irreversible_action` → `critical`
- `risk_exceeds_threshold` → at least `high`
- `multi_role_disagreement` → at least `medium`

### 2.3 Decision Lifecycle

```
         propose
  ────────────────► proposed
                       │
                  review / escalate
                       │
                       ▼
                  under_review
                       │
              ┌────────┼────────┐
              │        │        │
           ratify    veto    timeout
              │        │        │
              ▼        │        ▼
          ratified     │    expired
              │        │
         implement     │
              │        │
              ▼        ▼
          in_effect  revoked
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
| `proposed` | Submitted, awaiting review |
| `under_review` | At least one reviewer or escalation is active |
| `ratified` | Approved by authorized principal; not yet executed |
| `in_effect` | Implementation complete; decision is active policy |
| `superseded` | Replaced by a newer decision |
| `revoked` | Explicitly invalidated |

**Invariants**:
- Status transitions are forward-only (no reversion to `proposed` from `under_review`).
- A vetoed decision transitions directly to `revoked`.
- `ratified` → `in_effect` requires confirmation that implementation steps are complete.
- Timeout: a decision in `under_review` past its deadline transitions to `revoked` with `details: "review_timeout"`.

### 2.4 RatificationRecord

```json
{
  "ratified_by": "string (principal_id)",
  "ratified_role": "string (role_id, must have ratify_decision capability)",
  "ratified_at": "string (ISO 8601)",
  "rationale": "string (why this decision was approved)",
  "review_addressal": "string (how independent review concerns were addressed)",
  "conditions": ["string (any conditions attached to ratification)"]
}
```

**Invariants**:
- `ratified_by` MUST NOT equal `proposer_principal_id` for `medium`+ decisions (separation of duties).
- For `critical` decisions, `review_addressal` MUST reference each Independent Review Record and explain how concerns were mitigated or accepted.

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
| **Pre-conditions** | Caller has `propose_decision` capability (Layer 4). All `evidence_ids` reference existing MemoryCells. |
| **Processing** | 1. Auto-classify risk level (may upgrade, never downgrade caller's classification). 2. Create Decision record with `status: proposed`. 3. If `critical`, verify at least one suitable reviewer exists. 4. Append AuditEvent. |
| **Output** | `{ decision_id, status: "proposed", risk_level }` |

### 3.2 Review Decision

Triggers transition to `under_review` and collects Independent Reviews (Layer 4 §3.6).

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id` |
| **Pre-conditions** | Decision is in `proposed` status. |
| **Processing** | 1. Set status to `under_review`. 2. Notify eligible reviewers. 3. Start review deadline timer (configurable, default: 24h for `critical`, 4h for `high`, 1h for `medium`). |
| **Output** | `{ decision_id, status: "under_review", deadline }` |

### 3.3 Ratify Decision

Approves a decision after review.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `rationale`, `review_addressal`, `conditions[]` (optional) |
| **Pre-conditions** | Caller has `ratify_decision` capability. Decision is `under_review`. For `critical`: at least one Independent Review Record exists with substance (Layer 4 §2.7). For `medium`+: caller is NOT the proposer. |
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
| **Processing** | 1. Verify implementation steps are addressed. 2. Set status to `in_effect`. 3. Set `effective_at`. 4. Append AuditEvent. |
| **Output** | `{ decision_id, status: "in_effect", effective_at }` |

### 3.6 Supersede Decision

Replaces an active decision with a new one.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | New Decision proposal with `supersedes` pointing to the target decision_id. |
| **Pre-conditions** | Target decision is `in_effect`. New decision goes through the full lifecycle (propose → review → ratify). |
| **Processing** | 1. On ratification of new decision: set target's status to `superseded`, set target's `superseded_by`. 2. Append AuditEvent for both. |
| **Output** | `{ new_decision_id, superseded_decision_id }` |

### 3.7 Revoke Decision

Explicitly invalidates an active decision.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `reason` |
| **Pre-conditions** | Decision is `in_effect`. Caller has `veto_decision` capability or is deadlock resolver. |
| **Processing** | 1. Set status to `revoked`. 2. Append AuditEvent. 3. If decision had downstream effects, log them in `details`. |
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

Decisions reference MemoryCells (Layer 1) as evidence. Evidence quality requirements vary by risk level:

| Risk Level | Evidence Requirement |
|---|---|
| `low` | No formal evidence required |
| `medium` | At least one `evidence_id` referencing an active MemoryCell |
| `high` | Evidence must include at least one `human_confirmed` or `raw_source` MemoryCell |
| `critical` | Evidence must include at least one `human_confirmed` MemoryCell; `llm_derived`-only evidence is insufficient |

### 4.2 Decision as Memory Generator

When a decision reaches `in_effect`, the implementation SHOULD create MemoryCells to record:
- The decision rationale (as `fact` type, `human_confirmed` tier)
- Any constraints introduced by the decision (as `constraint` type)
- Lessons learned during review (as `lesson` type)

These become part of organizational knowledge and may be referenced as evidence for future decisions.

### 4.3 Anti-Ouroboros Interaction

The Anti-Ouroboros Rule (Layer 2) protects against LLM-derived knowledge self-reinforcement. At the Decision Layer, this means:
- A decision whose evidence is entirely `llm_derived` MUST be flagged for human review.
- An agent MUST NOT ratify a decision based solely on its own prior `llm_derived` output.

---

## 5. Integration with Other Layers

### 5.1 Layer 1 (Memory)
- `evidence_ids` in proposals reference MemoryCells.
- Ratified decisions generate new MemoryCells (§4.2).
- Decision records are NOT MemoryCells — they have their own storage and lifecycle.

### 5.2 Layer 2 (Trust)
- Evidence tier requirements (§4.1) enforce trust quality in decision-making.
- Anti-Ouroboros interaction (§4.3) prevents LLM self-reinforcement at governance level.

### 5.3 Layer 3 (Identity)
- `proposer_principal_id` and `ratified_by` must be valid, active Principals.
- Separation of duties: proposer ≠ ratifier for `medium`+ decisions.

### 5.4 Layer 4 (Authority)
- `propose_decision`, `ratify_decision`, `veto_decision` capabilities gate all operations.
- Independent Review (Layer 4 §2.7) is the review mechanism for `high`/`critical` decisions.
- Escalation triggers feed from Layer 4 into decision review.
- `critical` classification triggers Layer 4's mandatory review requirements.

### 5.5 Backward Compatibility

Layer 5 is OPTIONAL. When not implemented:
- Organizational decisions are informal (no structured lifecycle).
- Layer 4 capabilities `propose_decision`, `ratify_decision`, `veto_decision` have no target state machine.
- Independent Review (Layer 4) can still function for memory operations.

---

## 6. Conformance

An implementation is **ACA Layer 5 conformant** if it:

1. Implements the Decision data model with the six-status lifecycle.
2. Enforces risk classification with auto-upgrade from escalation triggers.
3. Enforces separation of duties (proposer ≠ ratifier for `medium`+).
4. Enforces evidence tier requirements by risk level.
5. Integrates with Layer 4 Independent Review for `high`/`critical` decisions.
6. Implements decision timeout (review deadline → revoked).
7. Supports decision supersession with full lifecycle for the replacement.
8. Maintains audit trail for all decision operations.
9. Passes the Layer 5 conformance test suite (forthcoming).

**Note**: Layer 5 conformance requires Layer 1+2+3+4 conformance. The layers are cumulative.

---

## References

- Simon, H. (1947), "Administrative Behavior" — bounded rationality in organizational decision-making
- Janis, I. (1972), "Victims of Groupthink" — groupthink failure modes in decision committees
- Schwenk, C. (1984), "Devil's Advocacy in Managerial Decision-Making" — structured dissent
- Kahneman, D. (2011), "Thinking, Fast and Slow" — cognitive biases in judgment and decision-making
- COINE Workshop Series — norms and governance for MAS: https://coin-workshop.github.io/
- EU AI Act (2024), Articles 9, 14 — risk management systems and human oversight
- Agent Memory Hall v0.8 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
