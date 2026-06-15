# Layer 2: Trust — Protocol Specification

**Status**: Draft v0.1 — June 2026

**Civilizational analog**: Notary systems, peer review, chain of custody

**Core question**: What does the organization believe?

---

## 1. Overview

The Trust Layer defines how organizational knowledge acquires, carries, and propagates trust. Every MemoryCell (Layer 1) has a trust pedigree — a record of where it came from, how it was verified, and what transformations it underwent.

**Dual nature of Trust**: Layer 2 defines the *primitives* of trust (source tiers, trust proofs, provenance chains, and the Anti-Ouroboros invariant). But trust is not confined to this layer — it is *applied* across all layers. Layer 3 (Identity) uses trust to verify principals. Layer 4 (Authority) uses trust to validate delegation chains. Layer 5 (Decision) uses trust to weigh evidence. The Constitution Plane uses trust to protect its own amendment process.

This dual nature is by design. Just as human trust mechanisms (seals, signatures, notarization) are defined in one legal domain but applied everywhere, ACA's trust primitives are defined here and referenced throughout.

---

## 2. Data Model

### 2.1 Source Tier

Every MemoryCell carries a `source.tier` field that classifies the provenance of its content. This is the most fundamental trust primitive in ACA.

| Tier | Definition | Trust Level | Example |
|---|---|---|---|
| `raw_source` | Direct observation, ingestion, or unprocessed external input | Low — authentic but unverified | Web scrape, sensor reading, raw document import |
| `llm_derived` | Generated, summarized, or synthesized by an AI agent | Medium — useful but potentially hallucinated | Agent-generated summary, LLM analysis, automated consolidation |
| `human_confirmed` | Reviewed and explicitly endorsed by a human principal | High — human-validated | Decision ratified by Chair, fact verified by human reviewer |

**Invariants**:
- Every MemoryCell MUST have exactly one `source.tier`.
- Tier MUST NOT be upgraded without a verifiable event (see §2.2 TrustProof).
- Tier MUST be preserved on transfer (Layer 1 §3.6). A `raw_source` memory transferred to another namespace remains `raw_source`.

### 2.2 TrustProof

A TrustProof is an optional attestation attached to a MemoryCell that provides structured evidence for its trust tier. While `source.tier` is required, a TrustProof provides the *why*.

```json
{
  "tier": "human_confirmed",
  "confirmed_by": "string (principal_id who verified)",
  "confirmed_at": "string (ISO 8601)",
  "evidence_ids": ["string (memory_ids that support this attestation)"],
  "method": "human_review | peer_consensus | automated_check | cross_reference"
}
```

**When TrustProof is required**:
- Any tier upgrade (e.g., `llm_derived` → `human_confirmed`) MUST be accompanied by a TrustProof.
- Any memory that will be used as evidence in a Decision (Layer 5) SHOULD carry a TrustProof.

**When TrustProof is optional**:
- Initial writes with `raw_source` or `llm_derived` tier do not require a TrustProof (the tier itself is self-evident).

### 2.3 ProvenanceChain

When a MemoryCell is transferred (Layer 1 §3.6) or superseded (Layer 1 §3.3), its trust history must be preserved. The ProvenanceChain records the full lineage.

```json
{
  "origin": {
    "memory_id": "string",
    "agent_id": "string",
    "namespace": "string",
    "tier": "raw_source | llm_derived | human_confirmed",
    "created_at": "string (ISO 8601)"
  },
  "transitions": [
    {
      "type": "transfer | supersede | tier_upgrade",
      "from_memory_id": "string",
      "to_memory_id": "string",
      "performed_by": "string (principal_id)",
      "performed_at": "string (ISO 8601)",
      "tier_before": "raw_source | llm_derived | human_confirmed",
      "tier_after": "raw_source | llm_derived | human_confirmed"
    }
  ]
}
```

**Invariant**: The ProvenanceChain is append-only. Transitions MUST NOT be removed or modified.

**Invariant**: `tier_before` and `tier_after` in each transition MUST be consistent with the actual tier values at the time of the transition. A tier upgrade without a corresponding TrustProof is a protocol violation.

---

## 3. Trust Rules

### 3.1 Anti-Ouroboros Rule

**This is ACA's signature innovation — the first protocol-level defense against runtime belief amplification in multi-agent systems.**

**Rule**: An `llm_derived` MemoryCell MUST NOT supersede another `llm_derived` MemoryCell without human intervention.

**Direction convention**: *candidate* is the new record; *target* is the existing record being superseded. Read as: "candidate supersedes target."

| Target (existing) | Candidate (new) | Allowed? |
|---|---|---|
| `llm_derived` | `llm_derived` | **✗ BLOCKED** |
| `raw_source` | `llm_derived` | ✓ allowed |
| `llm_derived` | `human_confirmed` | ✓ allowed |
| `human_confirmed` | `human_confirmed` | ✓ allowed |
| `llm_derived` | `raw_source` | ✓ allowed |
| `raw_source` | `raw_source` | ✓ allowed |
| `raw_source` | `human_confirmed` | ✓ allowed |
| `human_confirmed` | `llm_derived` | ✓ allowed |
| `human_confirmed` | `raw_source` | ✓ allowed |

**Threat model boundary**: The Anti-Ouroboros Rule specifically guards the `supersede` operation. It does NOT guard against: (a) parallel writes of semantically equivalent `llm_derived` records with different `content_hash`; (b) RAG systems feeding old `llm_derived` content as context for new `llm_derived` writes (context pollution); (c) transfer-based belief propagation. These are real threats but are outside the scope of this protocol-level gate. Implementations SHOULD layer additional safeguards (e.g., semantic dedup, RAG tier labeling per §4.1) to address them.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | A supersede operation where the new MemoryCell has `source.tier: llm_derived` and the target has `source.tier: llm_derived`. |
| **Pre-conditions** | Both records exist; target is `active`. |
| **Processing** | Check `new.source.tier` and `target.source.tier`. If both are `llm_derived`, reject. |
| **Output** | `AntiOuroborosError { new_memory_id, target_memory_id, message }` |
| **Failure mode** | The write is rejected. No state change occurs. An AuditEvent with `operation: rejected` MUST be appended (per Layer 1 §3.1 Mandatory Audit for rejected writes). |

**Rationale**: In human civilization, knowledge is anchored to external reality — empirical observation, physical evidence, consensus of independent witnesses. AI agents have no such anchor. An agent can cite its own previous output as evidence, effectively creating a closed loop where generated knowledge validates generated knowledge. Over iterations, these loops amplify errors and hallucinations until fiction becomes organizational "truth."

This is distinct from *training-time model collapse* (Shumailov et al., Nature 2024), which describes distributional degradation when models are recursively trained on their own output. The Anti-Ouroboros Rule addresses *runtime belief amplification* — a phenomenon where LLM-derived organizational knowledge autonomously overwrites LLM-derived organizational knowledge, creating unfalsifiable consensus without human checkpoint.

The closest academic work is the NeurIPS 2025 paper "Safeguarding LLM Multi-Agent Collaborations with Temporal Graph" (runtime hallucination propagation detection) and NAACL 2025's BTProp framework (belief tree propagation). Neither operates at the protocol level; both are detection frameworks, not prevention mechanisms. ACA's Anti-Ouroboros Rule is, to the author's knowledge, the first *protocol-level structural constraint* against this class of failure.

### 3.2 Tier Transition Rules

| From | To | Condition |
|---|---|---|
| `raw_source` | `llm_derived` | Agent processes raw content (automatic; TrustProof optional) |
| `raw_source` | `human_confirmed` | Human reviews raw content (TrustProof required) |
| `llm_derived` | `human_confirmed` | Human reviews agent output (TrustProof required) |
| `human_confirmed` | `llm_derived` | **FORBIDDEN** — tier downgrades are not permitted |
| `human_confirmed` | `raw_source` | **FORBIDDEN** — tier downgrades are not permitted |
| `llm_derived` | `raw_source` | **FORBIDDEN** — tier downgrades are not permitted |

**Invariant**: Tier transitions are monotonically non-decreasing. Once knowledge is confirmed, it cannot be unconfirmed — only superseded or revoked.

### 3.3 Transfer Trust Preservation

When a MemoryCell is transferred (Layer 1 §3.6):

1. The `source.tier` of the new record MUST equal the `source.tier` of the original.
2. The ProvenanceChain of the new record MUST include the original's chain plus a new `transfer` transition.
3. Transfer does NOT constitute verification. A transferred `llm_derived` memory remains `llm_derived` regardless of who receives it.

---

## 4. Consumer Responsibilities

Downstream consumers of MemoryCells (other ACA layers, RAG systems, agent prompts) MUST respect trust tiers:

### 4.1 RAG and Context Assembly

When assembling context for an LLM prompt from organizational memory:

- `human_confirmed` memories MAY be presented as established facts.
- `llm_derived` memories MUST be labeled as agent-generated (e.g., "According to a previous agent analysis...").
- `raw_source` memories MUST be labeled as unverified (e.g., "From an unverified external source...").

Failure to label tiers in assembled context propagates trust ambiguity — the exact failure mode that the Trust Layer exists to prevent.

### 4.2 Decision Evidence

When a MemoryCell is cited as evidence in a Decision (Layer 5):

- `human_confirmed` evidence carries full weight.
- `llm_derived` evidence SHOULD be corroborated by at least one other source.
- `raw_source` evidence MUST be explicitly flagged as unverified in the Decision record.

### 4.3 Fail-Closed Default

When `source.tier` is missing, malformed, or unrecognized:

- Treat as `raw_source` (lowest trust level).
- Log a warning.
- Do NOT silently promote to `llm_derived` or `human_confirmed`.

---

## 5. Conformance

An implementation is **ACA Layer 2 conformant** if it:

1. Enforces the three-tier `source.tier` classification on all MemoryCells.
2. Implements the Anti-Ouroboros Rule as a mandatory gate (rejecting `llm_derived` superseding `llm_derived`).
3. Preserves `source.tier` on transfer without upgrade.
4. Forbids tier downgrades.
5. Supports TrustProof attachment on tier upgrade operations.
6. Maintains ProvenanceChain append-only integrity on transfer and supersede.
7. Implements fail-closed default for missing or malformed tier values.
8. Passes the Layer 2 conformance test suite (forthcoming).

**Note**: Layer 2 conformance requires Layer 1 conformance. The layers are cumulative.

---

## Evidence

Production incidents and academic research documenting the need for this layer. Full catalog: [evidence/Evidence_Catalog.md](../evidence/Evidence_Catalog.md) | Anti-Ouroboros evidence: [evidence/Anti_Ouroboros_Evidence.md](../evidence/Anti_Ouroboros_Evidence.md)

| ID | Summary |
|---|---|
| T-1 | On a 770K+ agent platform, prompt injections propagated through inter-agent trust with no verification |
| T-2 | A single compromised agent reportedly cascaded through 87% of downstream decisions in 4 hours |
| T-A1 | Trust Paradox (arXiv 2025): higher inter-agent trust improves task success but proportionally raises exposure risk |
| T-A2 | Prompt Infection (ICLR 2025): self-replicating injection propagates across agents like a computer virus |
| T-A3 | Bidirectional Belief Amplification (PMC 2025): 300+ simulations confirm agent-to-agent feedback loops amplify errors |

---

## References

- Shumailov et al. (2024), "AI models collapse when trained on recursively generated data" — Nature. Training-time model collapse; ACA addresses the runtime analog.
- "Safeguarding LLM Multi-Agent Collaborations with Temporal Graph" — NeurIPS 2025. Runtime hallucination propagation detection in MAS.
- "A Probabilistic Framework for LLM Hallucination Detection via Belief Tree Propagation" — NAACL 2025. Belief propagation framework.
- "CEDA: Cross-modal Evaluation through Debate Agents" — NeurIPS 2025. Multi-agent hallucination detection via debate.
- COINE Workshop Series — coordination, organizations, institutions, norms for governance of MAS: https://coin-workshop.github.io/
- Agent Memory Hall v0.6 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
