# Layer 4: Authority — Protocol Specification

**Status**: Draft v0.2 — June 2026

**Civilizational analog**: Parliament, judiciary, separation of powers

**Core question**: Who has the right to decide?

---

## 1. Overview

The Authority Layer defines how power is distributed, delegated, and constrained within an agent organization. It sits above Identity (Layer 3), which establishes *who* can act. This layer determines *what* each actor is authorized to decide.

Every multi-agent system faces the authority problem: when agents disagree, who wins? When a decision is irreversible, who approves it? When rules need to change, who has the power to change them? Without explicit answers, authority defaults to whoever acts first — a race condition masquerading as governance.

**Design principle**: Authority is declared, not assumed. Every role, capability, and constraint is explicit in the Role Manifest. There are no implicit powers — including for the deadlock resolution authority. If a capability is not listed, the principal does not have it.

**Relationship to Layer 3**: Layer 3 defines *principals* (who exists) and *grants* (who can access which namespace). Layer 4 defines *roles* (what a principal can do within an organization) and *escalation* (what happens when authority is insufficient). A principal may hold multiple roles. A role may be held by multiple principals. The mapping is many-to-many.

### 1.1 Authorization Pipeline

When Layer 4 is enabled, every state-changing operation passes through a two-stage authorization pipeline:

```
Request → Authenticate (L3) → Authorize Namespace (L3) → Check Authority (L4) → Execute
```

Both stages MUST pass. A request that passes L3 namespace authorization but fails L4 capability check is denied. A request that passes L4 capability check but lacks L3 namespace grant is denied. This is a conjunctive policy: `allowed = L3.authorize() AND L4.checkAuthority()`.

---

## 2. Data Model

### 2.1 Role

A Role defines a set of capabilities and constraints within an organization.

```json
{
  "role_id": "string (unique identifier, e.g. 'architect', 'implementer', 'resolver')",
  "display_name": "string (human-readable label)",
  "scope": "string (domain of authority, e.g. 'system_design', 'code_execution', 'all')",
  "capabilities": ["Capability (see §2.2)"],
  "constraints": ["Constraint (see §2.3)"],
  "risk_threshold": "number | null (0-100 scale; escalation triggers when exceeded)",
  "escalation_target": "string | null (role_id to escalate to when authority is insufficient)",
  "created_at": "string (ISO 8601)",
  "status": "active | suspended | revoked"
}
```

### 2.2 Deadlock Resolution Authority

Every organization MUST define a **deadlock resolution mechanism**. The protocol does not mandate the shape of this mechanism — it mandates its existence. Conformant implementations MUST support at least one of:

| Mechanism | Description | When to use |
|---|---|---|
| `single_resolver` | One principal with explicit resolution capabilities | Small teams, human-chaired orgs |
| `quorum` | N-of-M principals must agree | Distributed orgs, high-stakes decisions |
| `rotating_resolver` | Resolution authority rotates on schedule or per-decision | Fairness, anti-capture |
| `escalation_chain` | Sequential escalation until a resolver accepts | Hierarchical orgs |

The resolver role:
- MUST have its capabilities explicitly listed (no implicit all-power).
- MUST include at minimum: `ratify_decision`, `veto_decision`, `escalate`, and `break_glass`.
- SHOULD include `grant_authority` and `revoke_authority` for organizational management.
- MUST be subject to at least one constraint: `cannot_self_approve` (the resolver cannot ratify their own proposals).
- MUST be bound to audit: every resolver action produces an AuditEvent.
- MUST be assigned to at least one active principal at all times.

**Break-glass**: The `break_glass` capability allows emergency override of normal authorization in time-critical situations. Break-glass actions:
- MUST produce a `break_glass` AuditEvent with mandatory `reason` and `evidence_ids`.
- MUST trigger a mandatory post-hoc review within a configurable time window.
- MUST NOT be used to modify governance rules (Constitution Plane changes are never emergencies).

### 2.3 Capability

A Capability is a named action that a role is authorized to perform.

**Standard capabilities** (implementations MAY extend with namespaced custom capabilities, e.g. `custom:deploy_staging`):

| Capability | Meaning |
|---|---|
| `write_memory` | Create MemoryCells (Layer 1) |
| `read_memory` | Query MemoryCells |
| `supersede_memory` | Replace existing MemoryCells |
| `revoke_memory` | Soft-delete MemoryCells |
| `transfer_memory` | Move MemoryCells across namespaces |
| `tier_upgrade` | Upgrade source tier (Layer 2) |
| `propose_decision` | Submit a decision proposal (Layer 5) |
| `ratify_decision` | Approve a decision proposal |
| `veto_decision` | Block a decision proposal |
| `grant_authority` | Assign roles to principals |
| `revoke_authority` | Remove roles from principals |
| `escalate` | Forward a decision to a higher authority |
| `execute_tool` | Invoke external tools (general MCP tool calls) |
| `break_glass` | Emergency override with mandatory post-hoc review |
| `modify_governance` | Change governance rules (Constitution Plane) |

**Parameterized capabilities**: Capabilities MAY carry parameters to restrict scope. For example:
- `execute_tool:search` — only search tools
- `write_memory:project:acme` — only to a specific namespace
- `tier_upgrade:llm_derived` — only to llm_derived, not human_confirmed

Implementations that do not support parameterized capabilities MUST treat the bare capability name as organization-wide.

### 2.4 Constraint

A Constraint is an explicit DENY rule that blocks an action regardless of capabilities. Evaluation logic: `IF action IN capabilities AND action NOT IN constraints → ALLOW; ELSE → DENY`.

**Standard constraints** (implementations MAY extend):

| Constraint | Meaning |
|---|---|
| `cannot_deploy` | Cannot trigger deployment or production changes |
| `cannot_delete_memory` | Cannot hard-delete MemoryCells (revoke is still allowed) |
| `cannot_override_decision` | Cannot supersede a ratified decision |
| `cannot_self_approve` | Cannot ratify own proposals |
| `cannot_modify_governance` | Cannot change governance rules |
| `requires_independent_review` | Proposals require an independent review before ratification |
| `requires_quorum:{n}` | Action requires N co-approvals |

**Constraint precedence**: Constraints always override capabilities. There is no ambiguity: any matching constraint results in DENY.

### 2.5 RoleAssignment

A RoleAssignment binds a Principal (Layer 3) to a Role.

```json
{
  "assignment_id": "string (unique identifier)",
  "principal_id": "string (Layer 3 principal)",
  "role_id": "string",
  "assigned_by": "string (principal_id who made the assignment)",
  "assigned_at": "string (ISO 8601)",
  "expires_at": "string | null",
  "scope_namespace": "string | null (namespace restriction; null = organization-wide)",
  "delegation_allowed": "boolean (whether assignee can sub-delegate this role)",
  "status": "active | revoked"
}
```

**Invariants**:
- Only principals with `grant_authority` capability can create RoleAssignments.
- The deadlock resolution role MUST be assigned to at least one active principal at all times.
- A principal MAY hold multiple roles. Capabilities are unioned; constraints are unioned (any constraint from any role applies).
- `delegation_allowed: false` (default) prevents the assignee from granting this role to others, even if they hold `grant_authority`.

**Evaluation order for scoped vs. org-wide assignments**: Scoped assignments (non-null `scope_namespace`) are evaluated first. If a scoped assignment carries a constraint, it applies to that namespace even if an org-wide assignment grants the capability. Deny wins.

### 2.6 EscalationTrigger

An EscalationTrigger defines when a decision must be escalated to a higher authority.

```json
{
  "trigger_id": "string",
  "condition": "EscalationCondition (see below)",
  "target_role": "string (role_id to escalate to)",
  "mandatory": "boolean (if true, escalation cannot be skipped)",
  "created_at": "string (ISO 8601)"
}
```

**Standard escalation conditions**:

| Condition | Triggers when |
|---|---|
| `risk_exceeds_threshold` | Decision risk level exceeds the acting role's `risk_threshold` |
| `irreversible_action` | Decision involves an externally irreversible operation (deployments, external API calls, data deletion beyond the ACA store) |
| `multi_role_disagreement` | Two or more roles disagree on a proposal |
| `governance_modification` | Decision modifies governance rules (Constitution Plane) |
| `scope_exceeded` | Action falls outside the role's declared scope |
| `deadline_exceeded` | Decision stuck in `under_review` past a configurable time limit |
| `insufficient_evidence_tier` | Ratification attempted with only `llm_derived` evidence for a decision requiring `human_confirmed` evidence |
| `principal_suspended` | A principal involved in an in-flight decision is suspended |
| `cost_exceeds_budget` | Estimated cost/compute/token impact exceeds the role's budget |

### 2.7 Independent Review Record

An Independent Review Record is a structured evaluation of a proposal, required by the Independent Review mechanism (the protocol's defense against groupthink).

```json
{
  "review_id": "string",
  "decision_id": "string (Layer 5 reference)",
  "reviewer_principal_id": "string",
  "reviewer_role_id": "string",
  "position": "approve | oppose | conditional_approve",
  "reasoning": "string (minimum 50 characters for critical decisions)",
  "risk_categories_addressed": ["correctness", "security", "cost", "reversibility", "evidence_quality"],
  "evidence_ids": ["string (memory_ids supporting the review)"],
  "created_at": "string (ISO 8601)"
}
```

**Independent Review rule**: For any decision classified as `critical` (Layer 5), at least one Independent Review Record MUST be submitted before ratification. The review MUST satisfy:

1. **Independence**: The reviewer MUST be a different principal than the proposer. Principals sharing the same `affiliation` (Layer 3 extension, e.g. same model vendor, same operator) are NOT considered independent for this purpose.
2. **Substance**: The `reasoning` field MUST be non-empty and address at least one `risk_categories_addressed` entry. For `critical` decisions, minimum 50 characters.
3. **Addressal**: The ratifying authority MUST reference the review in their ratification rationale — either accepting the concerns and explaining mitigation, or acknowledging the risk.

A `critical` decision with zero Independent Review Records is a protocol violation.

**Relationship to `requires_independent_review` constraint**: The constraint applies this rule to ALL proposals from a specific role, not just `critical` ones.

---

## 3. Operations

### 3.1 Define Role

Creates or updates a Role in the organization.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `role_id`, `scope`, `capabilities[]`, `constraints[]`, `risk_threshold` (optional), `escalation_target` (optional) |
| **Pre-conditions** | Caller has `grant_authority` capability. For new roles: `role_id` is unique. For updates: role exists and caller's action is audited with before/after diff. |
| **Processing** | 1. Validate capabilities and constraints are from standard set or registered extensions. 2. Persist Role. 3. Append AuditEvent. |
| **Output** | `{ role_id, status: "active" }` |

### 3.2 Assign Role

Binds a Principal to a Role.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `principal_id`, `role_id`, `scope_namespace` (optional), `delegation_allowed` (default false) |
| **Pre-conditions** | Caller has `grant_authority`. Principal exists and is active (Layer 3). Role exists and is active. If role was assigned to caller with `delegation_allowed: false`, caller cannot reassign it. |
| **Processing** | 1. Create RoleAssignment. 2. Append AuditEvent. |
| **Output** | `{ assignment_id, principal_id, role_id }` |

### 3.3 Revoke Role Assignment

Removes a Principal's role.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `assignment_id`, `revoked_by` (principal_id) |
| **Pre-conditions** | Caller has `revoke_authority`. Cannot revoke the last active deadlock resolver assignment (invariant). |
| **Processing** | 1. Set RoleAssignment status to `revoked`. 2. Append AuditEvent. |
| **Output** | `{ assignment_id, status: "revoked" }` |

### 3.4 Check Authority

Determines whether a principal can perform an action. This runs AFTER Layer 3 authorization (see §1.1 Authorization Pipeline).

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `principal_id`, `action` (capability name, optionally parameterized), `namespace` (optional) |
| **Processing** | 1. Get all active, non-expired RoleAssignments for principal. 2. If `namespace` provided, include only assignments where `scope_namespace` is null (org-wide) or matches. 3. Union capabilities across matching roles. 4. Union constraints across matching roles. 5. If action is in capabilities AND NOT blocked by any constraint, return allowed. |
| **Output** | `{ allowed: boolean, roles: string[], constraints_applied: string[] }` |

**Fail-closed**: If authority cannot be determined (unknown principal, system error, no matching assignments), deny.

### 3.5 Escalate

Forwards a decision or action to a higher authority.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id` or `action_description`, `reason`, `escalated_by` (principal_id) |
| **Processing** | 1. Determine escalation target from role's `escalation_target` or matching EscalationTrigger. 2. Create escalation record. 3. Notify target role holders. 4. Append AuditEvent. |
| **Output** | `{ escalation_id, target_role, status: "pending" }` |

### 3.6 Submit Independent Review

Submits a structured evaluation of a proposal.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `decision_id`, `position`, `reasoning`, `risk_categories_addressed[]`, `evidence_ids[]` |
| **Pre-conditions** | Caller is assigned a role. Decision is in `proposed` or `under_review` status (Layer 5). Caller is NOT the proposer (independence). |
| **Processing** | 1. Validate independence (different principal, different affiliation if available). 2. Validate substance (reasoning non-empty, ≥1 risk category, ≥50 chars for critical). 3. Create Independent Review Record. 4. Append AuditEvent. |
| **Output** | `{ review_id, decision_id, position }` |

---

## 4. Governance Self-Modification Safeguards

Operations that modify the authority system itself (`grant_authority`, `revoke_authority`, `modify_governance`) carry elevated risk. The following safeguards apply:

### 4.1 Separation of Duties

- A principal MUST NOT ratify their own authority changes (enforced by `cannot_self_approve`).
- Changes to the deadlock resolution role MUST require approval from a principal who is NOT currently in that role.

### 4.2 Quorum for Governance Changes

For organizations with >2 principals holding `grant_authority`:
- Adding or removing `modify_governance` capability from any role SHOULD require quorum approval (configurable, default: majority).
- Changing the deadlock resolution mechanism MUST require quorum approval.

### 4.3 Audit Transparency

All governance self-modification operations MUST produce AuditEvents with:
- Full before/after diff of the changed role or assignment
- Principal who initiated, approved, and (if applicable) dissented
- Correlation to any Independent Review that preceded the change

---

## 5. Integration with Other Layers

### 5.1 Layer 1 (Memory)

When Layer 4 is enabled, memory operations check authority AFTER Layer 3 namespace authorization:
- `writeMemory`: requires `write_memory` capability
- `readMemory`: requires `read_memory` capability
- `supersedeMemory`: requires `supersede_memory` capability
- `revokeMemory`: requires `revoke_memory` capability
- `expireMemory`: requires `revoke_memory` capability (expire is a form of retirement)
- `transferMemory`: requires `transfer_memory` capability on both source and target namespaces

### 5.2 Layer 2 (Trust)

- `tierUpgrade`: requires `tier_upgrade` capability. Combined with Layer 3's human principal enforcement for `human_confirmed`.
- Independent Review Records for critical decisions SHOULD reference evidence MemoryCells at `human_confirmed` tier when available.

### 5.3 Layer 3 (Identity)

- RoleAssignment references a Layer 3 Principal. A suspended principal's role assignments are effectively inactive (MUST NOT pass `checkAuthority`).
- The Authorization Pipeline (§1.1) composes L3 and L4: `allowed = L3.authorize(principal, namespace, permission) AND L4.checkAuthority(principal, action, namespace)`.
- `grant_authority` (L4) and `admin` (L3) serve different purposes: L3 `admin` manages namespace access; L4 `grant_authority` manages organizational roles. Both are needed for full management.

### 5.4 Layer 5 (Decision) — Forward Reference

- `propose_decision`, `ratify_decision`, `veto_decision` capabilities gate Decision Layer operations.
- Escalation triggers feed into the Decision Layer's review process.
- Independent Review is enforced at ratification time: a `critical` decision without a review record cannot be ratified.
- `critical` classification is defined by Layer 5. Until Layer 5 is specified, implementations MAY use: any decision involving `irreversible_action`, `governance_modification`, or `risk_exceeds_threshold` escalation triggers.

### 5.5 Backward Compatibility

Layer 4 is OPTIONAL. Implementations that do not implement Layer 4 remain Layer 1+2+3 conformant. When Layer 4 is not implemented:

- **Layer 3 authorization remains fully enforced.** Namespace grants still control who can read/write where.
- Layer 4 capability checks are skipped — all L3-authorized actions are allowed.
- No escalation or independent review mechanisms exist.
- The deadlock resolution authority is implicitly the namespace owner (Layer 3).

**This fallback does NOT grant universal authorization.** It simply removes the capability layer while preserving the namespace authorization layer.

### 5.6 Bootstrap

When an organization is first created, a bootstrap sequence is required:

1. Register the first human principal (Layer 3).
2. Define the initial set of roles, including the deadlock resolution role.
3. Assign the deadlock resolution role to the first human principal.
4. Grant `grant_authority` to the resolution role.

Steps 1-4 are performed by the implementation's setup process (not by the protocol itself). After bootstrap, all subsequent authority changes go through the normal `grant_authority` → `Assign Role` flow.

---

## 6. Conformance

An implementation is **ACA Layer 4 conformant** if it:

1. Implements the Role data model with capabilities, constraints, risk thresholds, and escalation targets.
2. Implements at least one deadlock resolution mechanism (§2.2) with explicit capabilities and `cannot_self_approve`.
3. Enforces the Authorization Pipeline (§1.1): L3 authorize AND L4 checkAuthority, conjunctive.
4. Provides `checkAuthority` with fail-closed semantics and constraint-over-capability precedence.
5. Implements escalation triggers with at least the nine standard conditions.
6. Implements Independent Review for critical decisions with independence and substance requirements (§2.7).
7. Enforces governance self-modification safeguards (§4): SoD, audit transparency.
8. Maintains audit trail for all authority operations (role definition, assignment, revocation, escalation, review).
9. Passes the Layer 4 conformance test suite (forthcoming).

**Note**: Layer 4 conformance requires Layer 1+2+3 conformance. The layers are cumulative.

---

## 7. Relationship to Existing Work

### 7.1 RBAC / ABAC

ACA Layer 4 builds on NIST RBAC (INCITS 359-2012) but extends it for multi-agent governance: roles carry constraints (not just permissions), escalation is a first-class operation (not an afterthought), and independent review is structurally required (not culturally assumed). Parameterized capabilities borrow from Attribute-Based Access Control (ABAC) for resource-level granularity.

### 7.2 Ostrom's Design Principles

Elinor Ostrom's eight principles for governing commons (1990) provide the theoretical foundation. ACA v0.2 addresses:

| Ostrom Principle | ACA Layer 4 Mapping | Status |
|---|---|---|
| 1. Clearly defined boundaries | Namespace isolation (L3) + Role scope (L4) | ✓ Implemented |
| 2. Proportional equivalence | Capabilities proportional to role scope | ✓ Implemented |
| 3. Collective-choice arrangements | Independent Review + quorum for governance changes | Partial (v0.2) |
| 4. Monitoring | Mandatory audit trail + AuditEvents | ✓ Implemented |
| 5. Graduated sanctions | — | Not yet (Layer 5/Governance Plane) |
| 6. Conflict-resolution mechanisms | Escalation + deadlock resolution | ✓ Implemented |
| 7. Recognized right to organize | Role Manifest is self-declared by org | ✓ Implemented |
| 8. Nested enterprises | Scoped role assignments + namespace hierarchy | Partial (v0.2) |

Principles 5 (graduated sanctions) and 8 (nested enterprises at scale) are deferred to Layer 5 and the Governance Plane.

### 7.3 COINE / MAS Governance

ACA Layer 4 is positioned within the COINE workshop tradition (coordination, organizations, institutions, norms, ethics for multi-agent systems). Compared to social law approaches (Shoham & Tennenholtz, 1995) which compile constraints statically, ACA supports runtime role modification and dynamic escalation. Compared to agent debate frameworks (CEDA, NeurIPS 2025), ACA's Independent Review is structural (protocol-level) rather than conversational (prompt-level).

---

## References

- Ostrom, E. (1990), "Governing the Commons: The Evolution of Institutions for Collective Action" — polycentric governance theory
- Floridi, L. & Cowls, J. (2019), "A Unified Framework of Five Principles for AI in Society" — ethical AI governance
- Dafoe, A. (2018), "AI Governance: A Research Agenda" — authority and control in AI systems
- Shoham, Y. & Tennenholtz, M. (1995), "On social laws for artificial agent societies" — compile-time social constraints for MAS
- Schwenk, C. (1984), "Devil's Advocacy in Managerial Decision-Making" — structured dissent in organizations
- NIST INCITS 359-2012, "Role-Based Access Control" — RBAC standard
- COINE Workshop Series — coordination, organizations, institutions, norms for MAS: https://coin-workshop.github.io/
- EU AI Act (2024), Articles 9, 12, 13, 14 — risk management, transparency, human oversight requirements
- Agent Memory Hall v0.8 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
