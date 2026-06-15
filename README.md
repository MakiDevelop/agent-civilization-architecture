# Agent Civilization Architecture

**An open governance protocol for multi-agent AI systems**

**v0.2** — 5 layer specs + governance plane + 34 conformance tests + [42 documented evidence entries](evidence/)

| Component | Specification | Tests | Reference Impl |
|---|---|---|---|
| Layer 1: Memory | [Spec](spec/layer1-memory.md) | [8 tests](conformance/layer1/) | [AMH v0.8](https://github.com/MakiDevelop/agent-memory-hall) |
| Layer 2: Trust | [Spec](spec/layer2-trust.md) | [5 tests](conformance/layer2/) | AMH v0.8 |
| Layer 3: Identity | [Spec](spec/layer3-identity.md) | [6 tests](conformance/layer3/) | AMH v0.8 |
| Layer 4: Authority | [Spec](spec/layer4-authority.md) | [6 tests](conformance/layer4/) | Planned |
| Layer 5: Decision | [Spec](spec/layer5-decision.md) | [5 tests](conformance/layer5/) | Planned |
| Governance Plane | [Spec](spec/governance-plane.md) | [4 tests](conformance/governance/) | Planned |

## Quick Start

```bash
# Try the reference implementation (Layer 1-3)
npx @chibakuma/agent-memory-hall serve

# Run conformance tests against your own implementation
# 1. Implement AcaTestAdapter interface
# 2. npm test
```

See [conformance/README.md](conformance/README.md) for the adapter interface.

---

## The Problem

Multi-agent systems don't fail from intelligence — they fail from governance:

- **53%** of organizations have had agents exceed their intended permissions ([CSA/Zenity, 2026](evidence/Evidence_Catalog.md))
- **88%** of organizations report confirmed or suspected agent security incidents ([Gravitee, 2026](evidence/Evidence_Catalog.md))
- A single compromised agent can cascade through downstream decision-making within hours ([evidence](evidence/Evidence_Catalog.md))
- Recursive LLM-derived data causes irreversible model collapse by generation 9 ([Shumailov et al., Nature 2024](evidence/Anti_Ouroboros_Evidence.md))

Agent frameworks (LangChain, CrewAI) solve coordination. Agent platforms (OpenAI, Anthropic, Google) solve deployment. **Nobody is solving governance.**

ACA defines the minimum viable institutions — memory, trust, identity, authority, decisions, and constitutional governance — that multi-agent systems need to function as organizations without collapse.

```
┌─ Governance Plane: CONSTITUTION ─────────────────────────┐
│  Constrains all layers. Rules about rules.               │
│  Amendment process, knowledge promotion, decay detection │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 5: DECISION — How does the organization decide?   │
│                                                          │
│  Layer 4: AUTHORITY — Who has the right to decide?       │
│                                                          │
│  Layer 3: IDENTITY — Who belongs? Who can act?           │
│                                                          │
│  Layer 2: TRUST — What does the organization believe?    │
│                                                          │
│  Layer 1: MEMORY — What does the organization remember?  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Transport: MCP / A2A / REST / File I/O                  │
└──────────────────────────────────────────────────────────┘
```

| Component | Specification | Conformance Tests | Reference Implementation |
|---|---|---|---|
| Layer 1: Memory | [Spec v0.1](spec/layer1-memory.md) | [8 tests](conformance/layer1/) | [AMH v0.8](https://github.com/MakiDevelop/agent-memory-hall) ✅ |
| Layer 2: Trust | [Spec v0.1](spec/layer2-trust.md) | [5 tests](conformance/layer2/) | AMH v0.8 ✅ |
| Layer 3: Identity | [Spec v0.1](spec/layer3-identity.md) | [6 tests](conformance/layer3/) | AMH v0.8 ✅ |
| Layer 4: Authority | [Spec v0.2](spec/layer4-authority.md) | [6 tests](conformance/layer4/) | Planned |
| Layer 5: Decision | [Spec v0.2](spec/layer5-decision.md) | [5 tests](conformance/layer5/) | Planned |
| Governance Plane | [Spec v0.1](spec/governance-plane.md) | In progress | Planned |

## Key Innovations

**Anti-Ouroboros Rule** — LLM-derived knowledge cannot supersede LLM-derived knowledge without human intervention. The first protocol-level defense against *runtime belief amplification* — distinct from training-time model collapse (Shumailov et al., 2024). [Details →](spec/layer2-trust.md#31-anti-ouroboros-rule)

**Deadlock Resolution Mechanism** — Every agent organization must define how deadlocks are broken — but the protocol doesn't mandate monarchy. Supports single resolver, quorum, rotating authority, and escalation chains. [Details →](spec/layer4-authority.md#22-deadlock-resolution-authority)

**Independent Review** — For critical decisions, structurally independent review is required — not optional politeness. Reviews must demonstrate substance (reasoning + risk categories) and be addressed in ratification. [Details →](spec/layer4-authority.md#27-independent-review-record)

**Anti-Ouroboros at Decision Level** — LLM agents cannot ratify critical governance decisions based solely on their own generated evidence. Protocol-level enforcement, not advisory. [Details →](spec/layer5-decision.md#43-anti-ouroboros-gate)

**Immutable Governance Rules** — Four axioms that no amendment can modify: Mandatory Audit, Anti-Ouroboros, Append-only Audit, Human Accountability. The protocol's equivalent of constitutional eternity clauses. [Details →](spec/governance-plane.md#23-immutable-rules)

**Authorization Pipeline** — Conjunctive two-stage authorization: Layer 3 namespace grants AND Layer 4 role capabilities must both pass. Neither alone is sufficient. [Details →](spec/layer4-authority.md#11-authorization-pipeline)

## Reading the Spec

| Document | Purpose |
|---|---|
| [Architecture](spec/architecture.md) | Start here — problem definition, five-layer + governance plane design, design principles |
| [Layer 1: Memory](spec/layer1-memory.md) | Data model, 8 operations, governance gates, conformance |
| [Layer 2: Trust](spec/layer2-trust.md) | Source tiers, Anti-Ouroboros, provenance chain, consumer responsibilities |
| [Layer 3: Identity](spec/layer3-identity.md) | Principals, credentials, namespace ACL, human enforcement |
| [Layer 4: Authority](spec/layer4-authority.md) | Roles, capabilities, constraints, escalation, independent review |
| [Layer 5: Decision](spec/layer5-decision.md) | Decision lifecycle, risk classification, evidence requirements, SoD |
| [Governance Plane](spec/governance-plane.md) | Immutable rules, amendments, knowledge promotion, governance health |

Research documents:
| [Civilization Theory](research/civilization-theory.md) | Why agent organizations need the same institutions as human civilizations |
| [Governance Roadmap](research/governance-roadmap.md) | From memory system to governance protocol |
| [Landscape Analysis](research/landscape-2026-06.md) | W3C CG status, competitive analysis |

## Conformance Test Suite

30 protocol-level tests across all layers. Implementation-agnostic — test against the adapter interface, not AMH internals.

```bash
# Test your implementation
# 1. Implement AcaTestAdapter (+ AcaIdentityAdapter, AcaAuthorityAdapter, AcaDecisionAdapter)
# 2. Point test runner at your adapter
# 3. All tests verify protocol conformance

npm test
```

See [conformance/README.md](conformance/README.md) for details.

## Reference Implementation

[Agent Memory Hall](https://github.com/MakiDevelop/agent-memory-hall) (`@chibakuma/agent-memory-hall` on npm) — Layer 1-3 conformant, 71 tests passing.

```bash
npx @chibakuma/agent-memory-hall serve
```

## Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| v0.1 Spec | Architecture + Layer 1-2 specs | ✅ Done |
| v0.2 Spec | Layer 3-5 + Governance Plane specs | ✅ Done |
| v0.2 Tests | 30+ conformance tests (all layers) | ✅ Done |
| v0.8 Ref Impl | AMH Layer 1-3 conformant | ✅ Done |
| v1.0 Ref Impl | AMH Layer 4-5 + Governance Plane | In progress |
| Multi-language | Python + Rust conformance-passing implementations | Planned |

### Academic Publication

| Target | Submission | Focus |
|---|---|---|
| **NeurIPS SEA 2026** | ~Sep 2026 | Anti-Ouroboros: runtime belief amplification vs training-time model collapse |
| **WMAC @ AAAI 2027** | ~Oct 2026 | Position paper: Organizational Cognition for Multi-Agent Systems |
| **COINE @ AAMAS 2027** | ~Feb 2027 | Full paper: ACA as governance protocol for LLM-native MAS |

## Relationship to Existing Work

| Standard/Tool | What it solves | What ACA adds |
|---|---|---|
| **MCP** | How agents access tools | How agent *organizations* govern knowledge and decisions |
| **A2A** | How agents communicate | How agents *trust* what they hear |
| **W3C DID** | Who is this agent | What is this agent *authorized* to do |
| **Ostrom (1990)** | Governing shared resources | Protocol-level implementation for AI agent commons |
| **COINE workshops** | Norms for MAS (theory) | Concrete protocol spec with conformance tests |

## EU AI Act Alignment

| EU AI Act Article | Requirement | ACA Coverage |
|---|---|---|
| Article 9 | Risk management system | Layer 5: Decision (risk classification) |
| Article 12 | Automatic logging | Layer 1: Memory (mandatory audit) |
| Article 13 | Transparency | Layer 2: Trust (source tier labeling) |
| Article 14 | Human oversight | Layer 4: Authority (deadlock resolver) + Governance Plane (human accountability) |

## License

[Apache License 2.0](LICENSE)

## Author

**Makito Chiba** — [GitHub](https://github.com/MakiDevelop) | [Blog](https://blog.chibakuma.com)

Built from operational experience running a seven-agent council across 60+ collaborative sessions. ACA operationalizes the [COINE community's](https://coin-workshop.github.io/) decade of governance research for LLM-native multi-agent systems.
