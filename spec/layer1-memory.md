# Layer 1: Memory — Protocol Specification

**Status**: Draft v0.1 — June 2026

**Civilizational analog**: Archives, libraries, historical records

**Core question**: What does the organization remember?

---

## 1. Overview

The Memory Layer defines how organizational knowledge is represented, persisted, queried, transferred, and retired. It is the foundational layer of Agent Civilization Architecture — all other layers depend on it.

The Memory Layer is deliberately *neutral*. It records what was written, by whom, and when. It does not evaluate whether a memory is trustworthy (Layer 2), authorized (Layer 3/4), or correctly decided (Layer 5). Truth is not this layer's concern; preservation is.

---

## 2. Data Model

### 2.1 MemoryCell

A MemoryCell is the atomic unit of organizational knowledge. Every memory in the system is represented as a MemoryCell.

```json
{
  "aca_version": "0.1",
  "memory_id": "string (UUID v4)",
  "version": "integer (positive, starting at 1)",
  "status": "active | superseded | revoked | expired",

  "agent_id": "string (identifier of the owning agent)",
  "namespace": "string (organizational boundary, e.g. 'project:acme')",
  "memory_type": "decision | fact | preference | constraint | lesson | risk",

  "content": {
    "format": "string (MIME type, e.g. 'text/plain', 'application/json')",
    "value": "string (the actual content)"
  },

  "source": {
    "type": "human | agent | system | document",
    "ref": "string (origin reference, e.g. 'session:abc', 'transfer:mem_xyz')",
    "tier": "raw_source | llm_derived | human_confirmed"
  },

  "content_hash": "string (BLAKE3 hex digest of content.value)",
  "created_at": "string (ISO 8601 with timezone)",
  "created_by": "string (principal who performed the write)",

  "valid_until": "string | null (ISO 8601, optional expiration)",
  "supersedes": "string | null (memory_id of the record this supersedes)"
}
```

**Required fields**: `aca_version`, `memory_id`, `version`, `status`, `agent_id`, `namespace`, `memory_type`, `content`, `source`, `created_at`, `created_by`.

**Computed fields**: `content_hash` — MUST be computed by the implementation on write. Callers MAY provide it; implementations MUST verify or recompute.

**Optional fields**: `valid_until`, `supersedes`.

### 2.2 AuditEvent

Every state-changing operation produces an AuditEvent. The audit log is append-only; events cannot be modified or deleted.

```json
{
  "event_id": "string (UUID v4)",
  "memory_id": "string (the affected MemoryCell)",
  "operation": "write | supersede | revoke | transfer",
  "agent_id": "string (who performed the operation)",
  "timestamp": "string (ISO 8601)",
  "details": "string | null (human-readable context)"
}
```

### 2.3 Status Lifecycle

```
         write
  ────────────► active
                  │
        ┌─────────┼──────────┐
        │         │          │
   supersede    revoke    expire
        │         │          │
        ▼         ▼          ▼
   superseded  revoked    expired
```

- `active`: The memory is current and queryable.
- `superseded`: Replaced by a newer memory (the new memory's `supersedes` field points to this one).
- `revoked`: Explicitly invalidated. Soft delete — the record remains in storage for audit purposes.
- `expired`: Past its `valid_until` date. Implementations MUST treat expired records as inactive on read.

**Invariant**: Status transitions are one-way. A `superseded`, `revoked`, or `expired` record MUST NOT return to `active`.

---

## 3. Operations

### 3.1 Write

Creates a new MemoryCell.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | A MemoryCell with `status: active`, `version: 1`. `memory_id` MAY be provided or generated. |
| **Pre-conditions** | Content is non-empty. `namespace` and `agent_id` are non-empty strings. `source.tier` is one of the three defined values. |
| **Processing** | 1. Compute `content_hash` (BLAKE3 of `content.value`). 2. Run Write Gate (see §4). 3. Persist the record. 4. Append AuditEvent with `operation: write`. |
| **Output** | `{ memory_id, version, content_hash, governance_applied[] }` |
| **Failure modes** | `DuplicateMemoryError` — active record with same `content_hash` exists in same namespace. `AntiOuroborosError` — see Layer 2 spec. `NamespaceViolationError` — caller namespace mismatch. `ValidationError` — missing or invalid required fields. |

### 3.2 Read

Queries MemoryCells.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | Query parameters: `memory_id` (exact), or filter by `namespace`, `memory_type`, `agent_id`, `text` (substring match on `content.value`), `limit`. |
| **Pre-conditions** | None beyond valid query structure. |
| **Processing** | 1. Apply lifecycle filter: exclude `superseded`, `revoked`, and `expired` records by default. 2. Apply namespace isolation (see §4.3). 3. Return matching records ordered by `created_at` descending. |
| **Output** | `MemoryCell[]` |
| **Failure modes** | `NamespaceViolationError` — caller requests a namespace they are not authorized to read (when namespace isolation is enforced). |
| **Options** | `filterInactive: false` — include inactive records (for audit and administrative use). |

### 3.3 Supersede

Replaces an existing memory with a new version.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | A new MemoryCell with `supersedes` pointing to the target `memory_id`. |
| **Pre-conditions** | Target memory exists and is `active`. New memory has `status: active`, `version: 1`. |
| **Processing** | 1. Run Write Gate on the new record (including Anti-Ouroboros check against the target). 2. Set target's status to `superseded`. 3. Persist the new record. 4. Append AuditEvent with `operation: supersede` for the target. 5. Append AuditEvent with `operation: write` for the new record. |
| **Output** | `{ memory_id (new), superseded_id (old), governance_applied[] }` |
| **Failure modes** | All Write failure modes, plus: `AntiOuroborosError` — new record is `llm_derived` superseding an `llm_derived` target (Layer 2 invariant). `TargetNotActiveError` — target is not in `active` status. |

### 3.4 Revoke

Soft-deletes a memory.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `memory_id` to revoke. |
| **Pre-conditions** | Target memory exists. |
| **Processing** | 1. Set target's status to `revoked`. 2. Append AuditEvent with `operation: revoke`. |
| **Output** | `{ memory_id, status: "revoked" }` |
| **Failure modes** | `NotFoundError` — memory does not exist. Revoking an already-revoked memory is idempotent (no error, no duplicate audit). |

### 3.5 Transfer

Copies a memory to another namespace and/or agent.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `memory_id` (source), `target_namespace`, `target_agent_id`. |
| **Pre-conditions** | Source memory exists and is `active`. Caller has read access to source namespace and write access to target namespace. |
| **Processing** | 1. Create a new MemoryCell in the target namespace with: new `memory_id`, `agent_id: target_agent_id`, `namespace: target_namespace`, `source.ref: "transfer:{original_memory_id}"`, `source.tier` preserved from original (tier does NOT upgrade on transfer). 2. Run Write Gate on the new record. 3. Append AuditEvent with `operation: transfer` for both source and new records. 4. Source record remains `active` (transfer is copy, not move). |
| **Output** | `{ new_memory_id, source_memory_id, governance_applied[] }` |
| **Failure modes** | All Write failure modes, plus: `NamespaceViolationError` — caller lacks permission to write to target namespace. `SourceNotActiveError` — source memory is not `active`. |

### 3.6 Audit

Retrieves the append-only event log for a memory.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `memory_id`. |
| **Pre-conditions** | None. Audit is accessible even for revoked/expired records. |
| **Processing** | Return all AuditEvents for the given `memory_id`, ordered by `timestamp` ascending. |
| **Output** | `AuditEvent[]` |
| **Failure modes** | `NotFoundError` — no events exist for this memory_id. |

---

## 4. Governance Gates

The Write Gate is a pipeline of checks that runs on every write and transfer operation. All gates are enabled by default. An implementation MAY allow disabling individual gates via configuration, but MUST document the security implications.

### 4.1 Content-Hash Deduplication

**Rule**: If an `active` record with the same `content_hash` exists in the same `namespace`, reject the write.

**Algorithm**: BLAKE3 hash of `content.value` (UTF-8 encoded bytes). BLAKE3 is chosen for speed and cryptographic strength.

**Failure**: `DuplicateMemoryError { existing_memory_id, content_hash }`

### 4.2 Anti-Ouroboros (delegated to Layer 2)

See [Layer 2: Trust](layer2-trust.md) §3.1.

### 4.3 Namespace Isolation

**Rule**: When namespace isolation is enabled, a caller MUST have an associated `caller_namespace`. Writes are restricted to the caller's own namespace. Reads default to the caller's namespace unless an explicit cross-namespace read is granted.

**Failure**: `NamespaceViolationError { requested_namespace, caller_namespace }`

### 4.4 Lifecycle Filter

**Rule**: Read operations MUST exclude `superseded`, `revoked`, and `expired` records by default. Records with `valid_until` in the past MUST be treated as `expired` regardless of their stored `status`.

**Override**: `filterInactive: false` returns all records including inactive ones. This is intended for audit and administrative operations only.

---

## 5. Storage Requirements

The Memory Layer is storage-agnostic. Implementations MAY use any persistence backend (SQLite, PostgreSQL, JSON files, HTTP APIs, etc.) as long as the following properties are maintained:

1. **Durability**: A successfully written MemoryCell MUST survive process restart.
2. **Atomicity**: A write-and-audit pair MUST be atomic. If the write succeeds but the audit append fails, both MUST be rolled back.
3. **Append-only audit**: The audit log MUST NOT support update or delete operations.
4. **Content-hash index**: The store MUST support efficient lookup by `content_hash` within a namespace (required for deduplication).

---

## 6. Wire Format

MemoryCells are serialized as JSON (RFC 8259). Implementations MUST accept and produce UTF-8 encoded JSON. Field ordering is not significant. Unknown fields MUST be preserved on read and re-emitted on write (forward compatibility).

The canonical form for content-hash computation is `content.value` as raw UTF-8 bytes, not the JSON-serialized form.

---

## 7. Conformance

An implementation is **ACA Layer 1 conformant** if it:

1. Correctly serializes and deserializes MemoryCell and AuditEvent structures.
2. Implements all six operations (write, read, supersede, revoke, transfer, audit) with the specified contracts.
3. Enforces all four governance gates by default.
4. Maintains append-only audit log integrity.
5. Passes the Layer 1 conformance test suite (forthcoming).

---

## References

- Agent Memory Hall v0.6 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
- BLAKE3 hash function: https://github.com/BLAKE3-team/BLAKE3
- RFC 8259 (JSON): https://tools.ietf.org/html/rfc8259
- Park et al. (2023), "Generative Agents: Interactive Simulacra of Human Behavior" — Memory Stream as foundational concept
- COINE Workshop Series — coordination, organizations, institutions, norms for governance of MAS: https://coin-workshop.github.io/
